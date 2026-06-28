from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta, date
import bcrypt
import jwt
import io
import secrets
from openpyxl import Workbook

ROOT_DIR = Path(__file__).parent

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==================== Password & JWT Helpers ====================
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_jwt_secret() -> str:
    return os.environ['JWT_SECRET']

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        'sub': user_id,
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(minutes=15),
        'type': 'access'
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        'sub': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=7),
        'type': 'refresh'
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get('access_token')
    if not token:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')
    
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get('type') != 'access':
            raise HTTPException(status_code=401, detail='Invalid token type')
        
        user = await db.users.find_one({'_id': ObjectId(payload['sub'])}, {'_id': 0})
        if not user:
            raise HTTPException(status_code=401, detail='User not found')
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')

def require_role(*allowed_roles):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user['role'] not in allowed_roles:
            raise HTTPException(status_code=403, detail='Permission denied')
        return user
    return role_checker

# ==================== Admin Seeding ====================
async def seed_admin():
    admin_email = os.environ.get('ADMIN_EMAIL', 'admin@avtomoyka.uz')
    admin_password = os.environ.get('ADMIN_PASSWORD', 'Admin123!')
    
    existing = await db.users.find_one({'email': admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            'email': admin_email,
            'password_hash': hashed,
            'name': 'Super Admin',
            'role': 'super_admin',
            'created_at': datetime.now(timezone.utc)
        })
    elif not verify_password(admin_password, existing['password_hash']):
        hashed = hash_password(admin_password)
        await db.users.update_one(
            {'email': admin_email},
            {'$set': {'password_hash': hashed}}
        )
    
    # Seed default services
    services = [
        ('Oddiy yuvish', 50000, 30),
        ('Ichki tozalash', 80000, 45),
        ('Tashqi yuvish', 40000, 20),
        ('Kompleks yuvish', 120000, 60),
        ('Motor yuvish', 60000, 30),
        ('Polirovka', 150000, 90),
        ('Mumlash', 100000, 60),
        ('Kimyoviy tozalash', 200000, 120)
    ]
    
    for name, price, duration in services:
        existing_service = await db.services.find_one({'name': name})
        if not existing_service:
            await db.services.insert_one({
                'name': name,
                'price': price,
                'duration': duration,
                'created_at': datetime.now(timezone.utc)
            })
    
    # Create indexes
    await db.users.create_index('email', unique=True)
    await db.orders.create_index('license_plate')
    await db.orders.create_index('status')
    await db.orders.create_index('assigned_to')
    await db.login_attempts.create_index('identifier')

# ==================== Models ====================
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: datetime

class ServiceCreate(BaseModel):
    name: str
    price: float
    duration: int

class ServiceResponse(BaseModel):
    id: str
    name: str
    price: float
    duration: int

class OrderCreate(BaseModel):
    license_plate: str
    brand: str
    model: str
    body_type: str
    color: str
    service_id: str
    notes: Optional[str] = None
    assigned_to: Optional[str] = None

class OrderResponse(BaseModel):
    id: str
    license_plate: str
    brand: str
    model: str
    body_type: str
    color: str
    service_id: str
    service_name: str
    price: float
    status: str
    payment_status: str
    payment_method: Optional[str]
    notes: Optional[str]
    assigned_to: Optional[str]
    assigned_to_name: Optional[str]
    arrived_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    paid_at: Optional[datetime]

class OrderStatusUpdate(BaseModel):
    status: str

class OrderPaymentUpdate(BaseModel):
    payment_method: str

# ==================== Auth Endpoints ====================
@api_router.post('/auth/login')
async def login(request: LoginRequest, response: Response):
    email = request.email.lower()
    
    # Check brute force
    identifier = email
    attempt_record = await db.login_attempts.find_one({'identifier': identifier})
    
    if attempt_record and attempt_record.get('locked_until'):
        if datetime.now(timezone.utc) < attempt_record['locked_until'].replace(tzinfo=timezone.utc):
            raise HTTPException(status_code=429, detail='Too many failed attempts. Try again later.')
    
    # Find user
    user = await db.users.find_one({'email': email})
    if not user or not verify_password(request.password, user['password_hash']):
        # Increment failed attempts
        if attempt_record:
            new_attempts = attempt_record['attempts'] + 1
            locked_until = None
            if new_attempts >= 5:
                locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
            await db.login_attempts.update_one(
                {'identifier': identifier},
                {'$set': {'attempts': new_attempts, 'locked_until': locked_until, 'updated_at': datetime.now(timezone.utc)}}
            )
        else:
            await db.login_attempts.insert_one({
                'identifier': identifier,
                'attempts': 1,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc)
            })
        raise HTTPException(status_code=401, detail='Invalid credentials')
    
    # Clear failed attempts
    await db.login_attempts.delete_one({'identifier': identifier})
    
    # Create tokens
    access_token = create_access_token(str(user['_id']), user['email'])
    refresh_token = create_refresh_token(str(user['_id']))
    
    response.set_cookie(
        key='access_token',
        value=access_token,
        httponly=True,
        secure=False,
        samesite='lax',
        max_age=900,
        path='/'
    )
    response.set_cookie(
        key='refresh_token',
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite='lax',
        max_age=604800,
        path='/'
    )
    
    return {
        'id': str(user['_id']),
        'email': user['email'],
        'name': user['name'],
        'role': user['role'],
        'created_at': user['created_at']
    }

@api_router.post('/auth/register')
async def register(request: RegisterRequest, response: Response, current_user: dict = Depends(require_role('super_admin'))):
    email = request.email.lower()
    
    existing = await db.users.find_one({'email': email})
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered')
    
    hashed = hash_password(request.password)
    result = await db.users.insert_one({
        'email': email,
        'password_hash': hashed,
        'name': request.name,
        'role': request.role,
        'created_at': datetime.now(timezone.utc)
    })
    
    user = await db.users.find_one({'_id': result.inserted_id}, {'_id': 0, 'password_hash': 0})
    user['id'] = str(result.inserted_id)
    return user

@api_router.post('/auth/logout')
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie('access_token', path='/')
    response.delete_cookie('refresh_token', path='/')
    return {'message': 'Logged out successfully'}

@api_router.get('/auth/me')
async def get_me(user: dict = Depends(get_current_user)):
    user_data = await db.users.find_one({'email': user['email']}, {'_id': 1, 'email': 1, 'name': 1, 'role': 1, 'created_at': 1})
    return {
        'id': str(user_data['_id']),
        'email': user_data['email'],
        'name': user_data['name'],
        'role': user_data['role'],
        'created_at': user_data['created_at']
    }

@api_router.post('/auth/refresh')
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get('refresh_token')
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')
    
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get('type') != 'refresh':
            raise HTTPException(status_code=401, detail='Invalid token type')
        
        user = await db.users.find_one({'_id': ObjectId(payload['sub'])})
        if not user:
            raise HTTPException(status_code=401, detail='User not found')
        
        access_token = create_access_token(str(user['_id']), user['email'])
        response.set_cookie(
            key='access_token',
            value=access_token,
            httponly=True,
            secure=False,
            samesite='lax',
            max_age=900,
            path='/'
        )
        return {'message': 'Token refreshed'}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')

# ==================== Users Endpoints ====================
@api_router.get('/users')
async def get_users(user: dict = Depends(require_role('super_admin'))):
    users = await db.users.find({}, {'password_hash': 0}).to_list(1000)
    return [{'id': str(u['_id']), **{k: v for k, v in u.items() if k != '_id'}} for u in users]

@api_router.delete('/users/{user_id}')
async def delete_user(user_id: str, user: dict = Depends(require_role('super_admin'))):
    await db.users.delete_one({'_id': ObjectId(user_id)})
    return {'message': 'User deleted'}

# ==================== Services Endpoints ====================
@api_router.get('/services')
async def get_services(user: dict = Depends(get_current_user)):
    services = await db.services.find({}, {'_id': 0}).sort('name', 1).to_list(1000)
    for s in services:
        s['id'] = str(s.pop('_id', '')) if '_id' in s else ''
    
    services_list = []
    cursor = db.services.find({}).sort('name', 1)
    async for s in cursor:
        services_list.append({
            'id': str(s['_id']),
            'name': s['name'],
            'price': s['price'],
            'duration': s['duration'],
            'created_at': s.get('created_at', datetime.now(timezone.utc))
        })
    return services_list

@api_router.post('/services')
async def create_service(service: ServiceCreate, user: dict = Depends(require_role('super_admin'))):
    result = await db.services.insert_one({
        'name': service.name,
        'price': service.price,
        'duration': service.duration,
        'created_at': datetime.now(timezone.utc)
    })
    
    return {
        'id': str(result.inserted_id),
        'name': service.name,
        'price': service.price,
        'duration': service.duration,
        'created_at': datetime.now(timezone.utc)
    }

@api_router.patch('/services/{service_id}')
async def update_service(service_id: str, service: ServiceCreate, user: dict = Depends(require_role('super_admin'))):
    result = await db.services.update_one(
        {'_id': ObjectId(service_id)},
        {'$set': {'name': service.name, 'price': service.price, 'duration': service.duration}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail='Service not found')
    
    updated = await db.services.find_one({'_id': ObjectId(service_id)})
    return {
        'id': str(updated['_id']),
        'name': updated['name'],
        'price': updated['price'],
        'duration': updated['duration'],
        'created_at': updated.get('created_at', datetime.now(timezone.utc))
    }

@api_router.delete('/services/{service_id}')
async def delete_service(service_id: str, user: dict = Depends(require_role('super_admin'))):
    await db.services.delete_one({'_id': ObjectId(service_id)})
    return {'message': 'Service deleted'}

# ==================== Orders Endpoints ====================
@api_router.get('/orders')
async def get_orders(
    status: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    
    if user['role'] == 'super_admin':
        if status:
            query['status'] = status
    elif user['role'] == 'kassir':
        if status:
            query['status'] = status
        else:
            query['status'] = {'$in': ['tugallandi', 'tolandi']}
    else:  # hodim
        user_data = await db.users.find_one({'email': user['email']})
        query['assigned_to'] = str(user_data['_id'])
    
    orders_list = []
    cursor = db.orders.find(query).sort('arrived_at', -1)
    async for o in cursor:
        order_dict = {
            'id': str(o['_id']),
            'license_plate': o['license_plate'],
            'brand': o['brand'],
            'model': o['model'],
            'body_type': o['body_type'],
            'color': o['color'],
            'service_id': o['service_id'],
            'service_name': o['service_name'],
            'price': o['price'],
            'status': o['status'],
            'payment_status': o['payment_status'],
            'payment_method': o.get('payment_method'),
            'notes': o.get('notes'),
            'assigned_to': o.get('assigned_to'),
            'assigned_to_name': None,
            'arrived_at': o['arrived_at'],
            'started_at': o.get('started_at'),
            'completed_at': o.get('completed_at'),
            'paid_at': o.get('paid_at')
        }
        
        if o.get('assigned_to'):
            assigned_user = await db.users.find_one({'_id': ObjectId(o['assigned_to'])}, {'name': 1})
            if assigned_user:
                order_dict['assigned_to_name'] = assigned_user['name']
        
        orders_list.append(order_dict)
    
    return orders_list

@api_router.post('/orders')
async def create_order(order: OrderCreate, user: dict = Depends(get_current_user)):
    # Get service details
    service = await db.services.find_one({'_id': ObjectId(order.service_id)})
    if not service:
        raise HTTPException(status_code=404, detail='Service not found')
    
    order_data = {
        'license_plate': order.license_plate.upper(),
        'brand': order.brand,
        'model': order.model,
        'body_type': order.body_type,
        'color': order.color,
        'service_id': order.service_id,
        'service_name': service['name'],
        'price': service['price'],
        'status': 'navbatda',
        'payment_status': 'kutilmoqda',
        'notes': order.notes,
        'assigned_to': order.assigned_to,
        'arrived_at': datetime.now(timezone.utc),
        'created_at': datetime.now(timezone.utc)
    }
    
    result = await db.orders.insert_one(order_data)
    
    order_dict = {
        'id': str(result.inserted_id),
        **{k: v for k, v in order_data.items() if k != '_id'},
        'assigned_to_name': None,
        'started_at': None,
        'completed_at': None,
        'paid_at': None,
        'payment_method': None
    }
    
    if order.assigned_to:
        assigned_user = await db.users.find_one({'_id': ObjectId(order.assigned_to)}, {'name': 1})
        if assigned_user:
            order_dict['assigned_to_name'] = assigned_user['name']
    
    return order_dict

@api_router.patch('/orders/{order_id}/status')
async def update_order_status(order_id: str, status_update: OrderStatusUpdate, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({'_id': ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail='Order not found')
    
    # Check permissions
    user_data = await db.users.find_one({'email': user['email']})
    if user['role'] == 'hodim' and order.get('assigned_to') != str(user_data['_id']):
        raise HTTPException(status_code=403, detail='Permission denied')
    
    updates = {'status': status_update.status}
    
    if status_update.status == 'yuvilmoqda':
        updates['started_at'] = datetime.now(timezone.utc)
        if not order.get('assigned_to'):
            updates['assigned_to'] = str(user_data['_id'])
    elif status_update.status == 'tugallandi':
        updates['completed_at'] = datetime.now(timezone.utc)
    
    await db.orders.update_one(
        {'_id': ObjectId(order_id)},
        {'$set': updates}
    )
    
    updated_order = await db.orders.find_one({'_id': ObjectId(order_id)})
    order_dict = {
        'id': str(updated_order['_id']),
        **{k: v for k, v in updated_order.items() if k != '_id'},
        'assigned_to_name': None
    }
    
    if updated_order.get('assigned_to'):
        assigned_user = await db.users.find_one({'_id': ObjectId(updated_order['assigned_to'])}, {'name': 1})
        if assigned_user:
            order_dict['assigned_to_name'] = assigned_user['name']
    
    return order_dict

@api_router.patch('/orders/{order_id}/payment')
async def update_order_payment(order_id: str, payment: OrderPaymentUpdate, user: dict = Depends(require_role('kassir', 'super_admin'))):
    result = await db.orders.update_one(
        {'_id': ObjectId(order_id)},
        {'$set': {
            'payment_status': 'tolandi',
            'payment_method': payment.payment_method,
            'paid_at': datetime.now(timezone.utc)
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail='Order not found')
    
    updated_order = await db.orders.find_one({'_id': ObjectId(order_id)})
    order_dict = {
        'id': str(updated_order['_id']),
        **{k: v for k, v in updated_order.items() if k != '_id'},
        'assigned_to_name': None
    }
    
    if updated_order.get('assigned_to'):
        assigned_user = await db.users.find_one({'_id': ObjectId(updated_order['assigned_to'])}, {'name': 1})
        if assigned_user:
            order_dict['assigned_to_name'] = assigned_user['name']
    
    return order_dict

@api_router.get('/orders/search')
async def search_orders(
    license_plate: Optional[str] = None,
    brand: Optional[str] = None,
    model: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    
    if license_plate:
        query['license_plate'] = {'$regex': license_plate.upper(), '$options': 'i'}
    if brand:
        query['brand'] = {'$regex': brand, '$options': 'i'}
    if model:
        query['model'] = {'$regex': model, '$options': 'i'}
    if start_date:
        query['arrived_at'] = {'$gte': datetime.fromisoformat(start_date)}
    if end_date:
        if 'arrived_at' in query:
            query['arrived_at']['$lte'] = datetime.fromisoformat(end_date)
        else:
            query['arrived_at'] = {'$lte': datetime.fromisoformat(end_date)}
    
    # Role-based filtering
    if user['role'] == 'hodim':
        user_data = await db.users.find_one({'email': user['email']})
        query['assigned_to'] = str(user_data['_id'])
    
    orders_list = []
    cursor = db.orders.find(query).sort('arrived_at', -1)
    async for o in cursor:
        order_dict = {
            'id': str(o['_id']),
            **{k: v for k, v in o.items() if k != '_id'},
            'assigned_to_name': None
        }
        
        if o.get('assigned_to'):
            assigned_user = await db.users.find_one({'_id': ObjectId(o['assigned_to'])}, {'name': 1})
            if assigned_user:
                order_dict['assigned_to_name'] = assigned_user['name']
        
        orders_list.append(order_dict)
    
    return orders_list

# ==================== Dashboard Endpoints ====================
@api_router.get('/dashboard/stats')
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    month_start = today.replace(day=1)
    
    if user['role'] == 'super_admin':
        # Admin sees everything
        today_orders = await db.orders.count_documents({'arrived_at': {'$gte': today}})
        
        today_revenue_cursor = db.orders.aggregate([
            {'$match': {'arrived_at': {'$gte': today}, 'payment_status': 'tolandi'}},
            {'$group': {'_id': None, 'total': {'$sum': '$price'}}}
        ])
        today_revenue_result = await today_revenue_cursor.to_list(1)
        today_revenue = today_revenue_result[0]['total'] if today_revenue_result else 0
        
        weekly_revenue_cursor = db.orders.aggregate([
            {'$match': {'arrived_at': {'$gte': week_ago}, 'payment_status': 'tolandi'}},
            {'$group': {'_id': None, 'total': {'$sum': '$price'}}}
        ])
        weekly_revenue_result = await weekly_revenue_cursor.to_list(1)
        weekly_revenue = weekly_revenue_result[0]['total'] if weekly_revenue_result else 0
        
        monthly_revenue_cursor = db.orders.aggregate([
            {'$match': {'arrived_at': {'$gte': month_start}, 'payment_status': 'tolandi'}},
            {'$group': {'_id': None, 'total': {'$sum': '$price'}}}
        ])
        monthly_revenue_result = await monthly_revenue_cursor.to_list(1)
        monthly_revenue = monthly_revenue_result[0]['total'] if monthly_revenue_result else 0
        
        unpaid_orders = await db.orders.count_documents({'payment_status': 'kutilmoqda'})
        completed_orders = await db.orders.count_documents({'status': {'$in': ['tugallandi', 'tolandi']}})
        waiting = await db.orders.count_documents({'status': 'navbatda'})
        washing = await db.orders.count_documents({'status': 'yuvilmoqda'})
        
        # Employee stats
        employee_stats = []
        employees = await db.users.find({'role': 'hodim'}).to_list(1000)
        for emp in employees:
            emp_id = str(emp['_id'])
            total_cars = await db.orders.count_documents({'assigned_to': emp_id})
            
            revenue_cursor = db.orders.aggregate([
                {'$match': {'assigned_to': emp_id, 'payment_status': 'tolandi'}},
                {'$group': {'_id': None, 'total': {'$sum': '$price'}}}
            ])
            revenue_result = await revenue_cursor.to_list(1)
            total_revenue = revenue_result[0]['total'] if revenue_result else 0
            
            employee_stats.append({
                'id': emp_id,
                'name': emp['name'],
                'total_cars': total_cars,
                'total_revenue': float(total_revenue)
            })
        
        return {
            'today_orders': today_orders,
            'today_revenue': float(today_revenue),
            'weekly_revenue': float(weekly_revenue),
            'monthly_revenue': float(monthly_revenue),
            'unpaid_orders': unpaid_orders,
            'completed_orders': completed_orders,
            'waiting_orders': waiting,
            'washing_orders': washing,
            'employee_stats': employee_stats
        }
    
    elif user['role'] == 'kassir':
        today_orders = await db.orders.count_documents({'arrived_at': {'$gte': today}})
        
        today_revenue_cursor = db.orders.aggregate([
            {'$match': {'arrived_at': {'$gte': today}, 'payment_status': 'tolandi'}},
            {'$group': {'_id': None, 'total': {'$sum': '$price'}}}
        ])
        today_revenue_result = await today_revenue_cursor.to_list(1)
        today_revenue = today_revenue_result[0]['total'] if today_revenue_result else 0
        
        pending_payment = await db.orders.count_documents({'status': 'tugallandi', 'payment_status': 'kutilmoqda'})
        
        return {
            'today_orders': today_orders,
            'today_revenue': float(today_revenue),
            'pending_payment': pending_payment
        }
    
    else:  # hodim
        user_data = await db.users.find_one({'email': user['email']})
        user_id = str(user_data['_id'])
        
        today_cars = await db.orders.count_documents({'assigned_to': user_id, 'arrived_at': {'$gte': today}})
        
        today_earnings_cursor = db.orders.aggregate([
            {'$match': {'assigned_to': user_id, 'arrived_at': {'$gte': today}, 'payment_status': 'tolandi'}},
            {'$group': {'_id': None, 'total': {'$sum': '$price'}}}
        ])
        today_earnings_result = await today_earnings_cursor.to_list(1)
        today_earnings = today_earnings_result[0]['total'] if today_earnings_result else 0
        
        my_orders = await db.orders.count_documents({'assigned_to': user_id, 'status': {'$in': ['navbatda', 'yuvilmoqda']}})
        
        return {
            'today_cars': today_cars,
            'today_earnings': float(today_earnings),
            'my_orders': my_orders
        }

# ==================== Customer History ====================
@api_router.get('/customers/{license_plate}/history')
async def get_customer_history(license_plate: str, user: dict = Depends(get_current_user)):
    orders_list = []
    cursor = db.orders.find({'license_plate': license_plate.upper()}).sort('arrived_at', -1)
    
    async for o in cursor:
        order_dict = {
            'id': str(o['_id']),
            **{k: v for k, v in o.items() if k != '_id'},
            'assigned_to_name': None
        }
        
        if o.get('assigned_to'):
            assigned_user = await db.users.find_one({'_id': ObjectId(o['assigned_to'])}, {'name': 1})
            if assigned_user:
                order_dict['assigned_to_name'] = assigned_user['name']
        
        orders_list.append(order_dict)
    
    if not orders_list:
        raise HTTPException(status_code=404, detail='No history found')
    
    total_visits = len(orders_list)
    total_spent = sum(o['price'] for o in orders_list if o['payment_status'] == 'tolandi')
    last_visit = orders_list[0]['arrived_at']
    
    return {
        'license_plate': license_plate.upper(),
        'total_visits': total_visits,
        'total_spent': float(total_spent),
        'last_visit': last_visit,
        'orders': orders_list
    }

# ==================== Reports Endpoints ====================
@api_router.get('/reports/today')
async def get_today_report(user: dict = Depends(require_role('kassir', 'super_admin'))):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    total_cars = await db.orders.count_documents({'arrived_at': {'$gte': today}})
    
    total_revenue_cursor = db.orders.aggregate([
        {'$match': {'arrived_at': {'$gte': today}, 'payment_status': 'tolandi'}},
        {'$group': {'_id': None, 'total': {'$sum': '$price'}}}
    ])
    total_revenue_result = await total_revenue_cursor.to_list(1)
    total_revenue = total_revenue_result[0]['total'] if total_revenue_result else 0
    
    # Payment breakdown
    payment_breakdown_cursor = db.orders.aggregate([
        {'$match': {'arrived_at': {'$gte': today}, 'payment_status': 'tolandi'}},
        {'$group': {'_id': '$payment_method', 'amount': {'$sum': '$price'}}}
    ])
    payment_breakdown = await payment_breakdown_cursor.to_list(100)
    payment_dict = {p['_id']: float(p['amount']) for p in payment_breakdown if p['_id']}
    
    # Employee stats
    employee_stats = []
    employees = await db.users.find({'role': 'hodim'}).to_list(1000)
    for emp in employees:
        emp_id = str(emp['_id'])
        cars_washed = await db.orders.count_documents({'assigned_to': emp_id, 'arrived_at': {'$gte': today}})
        
        earnings_cursor = db.orders.aggregate([
            {'$match': {'assigned_to': emp_id, 'arrived_at': {'$gte': today}, 'payment_status': 'tolandi'}},
            {'$group': {'_id': None, 'total': {'$sum': '$price'}}}
        ])
        earnings_result = await earnings_cursor.to_list(1)
        earnings = earnings_result[0]['total'] if earnings_result else 0
        
        employee_stats.append({
            'id': emp_id,
            'name': emp['name'],
            'cars_washed': cars_washed,
            'earnings': float(earnings)
        })
    
    return {
        'date': today.date().isoformat(),
        'total_cars': total_cars,
        'total_revenue': float(total_revenue),
        'cash': payment_dict.get('naqd', 0),
        'card': payment_dict.get('karta', 0),
        'click': payment_dict.get('click', 0),
        'payme': payment_dict.get('payme', 0),
        'employee_stats': employee_stats
    }

@api_router.post('/reports/close-day')
async def close_day(user: dict = Depends(require_role('super_admin'))):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_date = today.date()
    
    # Check if already closed
    existing = await db.daily_reports.find_one({'report_date': today_date.isoformat()})
    if existing and existing.get('is_closed'):
        raise HTTPException(status_code=400, detail='Day already closed')
    
    # Get today's data
    total_cars = await db.orders.count_documents({'arrived_at': {'$gte': today}})
    
    total_revenue_cursor = db.orders.aggregate([
        {'$match': {'arrived_at': {'$gte': today}, 'payment_status': 'tolandi'}},
        {'$group': {'_id': None, 'total': {'$sum': '$price'}}}
    ])
    total_revenue_result = await total_revenue_cursor.to_list(1)
    total_revenue = total_revenue_result[0]['total'] if total_revenue_result else 0
    
    payment_breakdown_cursor = db.orders.aggregate([
        {'$match': {'arrived_at': {'$gte': today}, 'payment_status': 'tolandi'}},
        {'$group': {'_id': '$payment_method', 'amount': {'$sum': '$price'}}}
    ])
    payment_breakdown = await payment_breakdown_cursor.to_list(100)
    payment_dict = {p['_id']: float(p['amount']) for p in payment_breakdown if p['_id']}
    
    user_data = await db.users.find_one({'email': user['email']})
    
    # Insert or update report
    report_data = {
        'report_date': today_date.isoformat(),
        'total_cars': total_cars,
        'total_revenue': float(total_revenue),
        'cash': payment_dict.get('naqd', 0),
        'card': payment_dict.get('karta', 0),
        'click': payment_dict.get('click', 0),
        'payme': payment_dict.get('payme', 0),
        'closed_by': str(user_data['_id']),
        'closed_at': datetime.now(timezone.utc),
        'is_closed': True
    }
    
    if existing:
        await db.daily_reports.update_one(
            {'report_date': today_date.isoformat()},
            {'$set': report_data}
        )
    else:
        await db.daily_reports.insert_one(report_data)
    
    return report_data

@api_router.get('/reports/export/excel')
async def export_excel(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(require_role('kassir', 'super_admin'))
):
    # Default to today if no dates provided
    if not start_date:
        start_date = datetime.now(timezone.utc).date().isoformat()
    if not end_date:
        end_date = start_date
    
    start_dt = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
    end_dt = datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
    
    orders_list = []
    cursor = db.orders.find({'arrived_at': {'$gte': start_dt, '$lte': end_dt}}).sort('arrived_at', -1)
    async for o in cursor:
        order_dict = dict(o)
        if o.get('assigned_to'):
            assigned_user = await db.users.find_one({'_id': ObjectId(o['assigned_to'])}, {'name': 1})
            order_dict['assigned_to_name'] = assigned_user['name'] if assigned_user else ''
        else:
            order_dict['assigned_to_name'] = ''
        orders_list.append(order_dict)
    
    # Create Excel workbook
    wb = Workbook()
    ws = wb.active
    ws.title = 'Hisobot'
    
    # Headers
    headers = ['ID', 'Davlat raqami', 'Marka', 'Model', 'Xizmat', 'Narx', 'Holat', 'To\'lov', 'To\'lov usuli', 'Hodim', 'Kelgan vaqt']
    ws.append(headers)
    
    # Data
    for order in orders_list:
        ws.append([
            str(order['_id']),
            order['license_plate'],
            order['brand'],
            order['model'],
            order['service_name'],
            float(order['price']),
            order['status'],
            order['payment_status'],
            order.get('payment_method', ''),
            order.get('assigned_to_name', ''),
            order['arrived_at'].strftime('%Y-%m-%d %H:%M')
        ])
    
    # Save to BytesIO
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename=hisobot_{start_date}_{end_date}.xlsx'}
    )

# ==================== Startup Event ====================
@app.on_event('startup')
async def startup():
    await seed_admin()
    logging.info('Database initialized and admin seeded')

@app.on_event('shutdown')
async def shutdown():
    client.close()

# ==================== Include Router ====================
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('FRONTEND_URL', 'http://localhost:3000').split(','),
    allow_methods=['*'],
    allow_headers=['*'],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
