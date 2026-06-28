import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Plus, Search, Car as CarIcon } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const statusColors = {
  navbatda: 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]',
  yuvilmoqda: 'bg-[#DBEAFE] text-[#1D4ED8] border-[#BFDBFE]',
  tugallandi: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]',
  tolandi: 'bg-[#0A1128] text-[#FFFFFF] border-[#0A1128]',
};

const statusLabels = {
  navbatda: 'Navbatda',
  yuvilmoqda: 'Yuvilmoqda',
  tugallandi: 'Tugallandi',
  tolandi: 'To\'landi',
};

const paymentLabels = {
  kutilmoqda: 'Kutilmoqda',
  tolandi: 'To\'landi',
};

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [services, setServices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // New order form state
  const [newOrder, setNewOrder] = useState({
    license_plate: '',
    brand: '',
    model: '',
    body_type: 'sedan',
    color: '',
    service_id: '',
    notes: '',
    assigned_to: '',
  });

  const [paymentMethod, setPaymentMethod] = useState('naqd');

  useEffect(() => {
    fetchOrders();
    fetchServices();
    if (user?.role === 'super_admin') {
      fetchEmployees();
    }
  }, []);

  const fetchOrders = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/orders`, {
        withCredentials: true,
      });
      setOrders(data);
    } catch (error) {
      toast.error('Buyurtmalar yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/services`, {
        withCredentials: true,
      });
      setServices(data);
    } catch (error) {
      toast.error('Xizmatlar yuklanmadi');
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/users`, {
        withCredentials: true,
      });
      setEmployees(data.filter((u) => u.role === 'hodim'));
    } catch (error) {
      console.error('Hodimlar yuklanmadi');
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/orders`, newOrder, {
        withCredentials: true,
      });
      toast.success('Mashina muvaffaqiyatli ro\'yxatdan o\'tkazildi');
      setShowNewOrderDialog(false);
      setNewOrder({
        license_plate: '',
        brand: '',
        model: '',
        body_type: 'sedan',
        color: '',
        service_id: '',
        notes: '',
        assigned_to: '',
      });
      fetchOrders();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await axios.patch(
        `${API_URL}/api/orders/${orderId}/status`,
        { status: newStatus },
        { withCredentials: true }
      );
      toast.success('Holat yangilandi');
      fetchOrders();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(
        `${API_URL}/api/orders/${selectedOrder.id}/payment`,
        { payment_method: paymentMethod },
        { withCredentials: true }
      );
      toast.success('To\'lov qabul qilindi');
      setShowPaymentDialog(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };

  const filteredOrders = orders.filter((order) =>
    order.license_plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052FF]"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0A1128] mb-2">
              Buyurtmalar
            </h1>
            <p className="text-base text-[#475569]">
              Barcha mashinalar va ularning holati
            </p>
          </div>
          {(user?.role === 'super_admin' || user?.role === 'kassir') && (
            <Dialog open={showNewOrderDialog} onOpenChange={setShowNewOrderDialog}>
              <DialogTrigger asChild>
                <Button
                  className="bg-[#0052FF] hover:bg-[#0043D1] text-white"
                  data-testid="add-order-button"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Yangi Mashina
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-semibold text-[#0A1128]">
                    Yangi mashina ro'yxatdan o'tkazish
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateOrder} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Davlat raqami</Label>
                      <Input
                        value={newOrder.license_plate}
                        onChange={(e) =>
                          setNewOrder({ ...newOrder, license_plate: e.target.value })
                        }
                        placeholder="01A001AA"
                        required
                        data-testid="order-license-plate-input"
                      />
                    </div>
                    <div>
                      <Label>Marka</Label>
                      <Input
                        value={newOrder.brand}
                        onChange={(e) => setNewOrder({ ...newOrder, brand: e.target.value })}
                        placeholder="Chevrolet"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Model</Label>
                      <Input
                        value={newOrder.model}
                        onChange={(e) => setNewOrder({ ...newOrder, model: e.target.value })}
                        placeholder="Malibu"
                        required
                      />
                    </div>
                    <div>
                      <Label>Kuzov turi</Label>
                      <Select
                        value={newOrder.body_type}
                        onValueChange={(value) =>
                          setNewOrder({ ...newOrder, body_type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sedan">Sedan</SelectItem>
                          <SelectItem value="suv">SUV</SelectItem>
                          <SelectItem value="hatchback">Hatchback</SelectItem>
                          <SelectItem value="coupe">Coupe</SelectItem>
                          <SelectItem value="minivan">Minivan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Rang</Label>
                      <Input
                        value={newOrder.color}
                        onChange={(e) => setNewOrder({ ...newOrder, color: e.target.value })}
                        placeholder="Oq"
                        required
                      />
                    </div>
                    <div>
                      <Label>Xizmat</Label>
                      <Select
                        value={newOrder.service_id}
                        onValueChange={(value) =>
                          setNewOrder({ ...newOrder, service_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tanlang" />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name} - {service.price.toLocaleString()} so'm
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {user?.role === 'super_admin' && employees.length > 0 && (
                    <div>
                      <Label>Hodim tayinlash (ixtiyoriy)</Label>
                      <Select
                        value={newOrder.assigned_to}
                        onValueChange={(value) =>
                          setNewOrder({ ...newOrder, assigned_to: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tanlang" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Tayinlanmagan</SelectItem>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label>Izoh (ixtiyoriy)</Label>
                    <Input
                      value={newOrder.notes}
                      onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                      placeholder="Qo'shimcha ma'lumot"
                    />
                  </div>

                  <div className="flex gap-3 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowNewOrderDialog(false)}
                    >
                      Bekor qilish
                    </Button>
                    <Button
                      type="submit"
                      className="bg-[#0052FF] hover:bg-[#0043D1] text-white"
                      data-testid="create-order-submit-button"
                    >
                      Ro'yxatdan o'tkazish
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Qidiruv (davlat raqami, marka, model)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="search-orders-input"
            />
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="orders-table">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                  <th className="text-left py-3 px-4">Mashina</th>
                  <th className="text-left py-3 px-4">Xizmat</th>
                  <th className="text-left py-3 px-4">Narx</th>
                  <th className="text-left py-3 px-4">Holat</th>
                  <th className="text-left py-3 px-4">To'lov</th>
                  {user?.role === 'super_admin' && (
                    <th className="text-left py-3 px-4">Hodim</th>
                  )}
                  <th className="text-left py-3 px-4">Vaqt</th>
                  <th className="text-left py-3 px-4">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={user?.role === 'super_admin' ? 8 : 7}
                      className="text-center py-12"
                    >
                      <CarIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500">Hozircha buyurtmalar yo'q</p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                      data-testid={`order-row-${order.id}`}
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-semibold text-[#0A1128]">
                            {order.license_plate}
                          </p>
                          <p className="text-sm text-[#475569]">
                            {order.brand} {order.model}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#475569]">{order.service_name}</td>
                      <td className="py-3 px-4 font-semibold text-[#0A1128]">
                        {order.price.toLocaleString()} so'm
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            statusColors[order.status]
                          }`}
                        >
                          {statusLabels[order.status]}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-sm font-medium ${
                            order.payment_status === 'tolandi'
                              ? 'text-[#047857]'
                              : 'text-[#B45309]'
                          }`}
                        >
                          {paymentLabels[order.payment_status]}
                        </span>
                      </td>
                      {user?.role === 'super_admin' && (
                        <td className="py-3 px-4 text-sm text-[#475569]">
                          {order.assigned_to_name || '-'}
                        </td>
                      )}
                      <td className="py-3 px-4 text-sm text-[#475569]">
                        {new Date(order.arrived_at).toLocaleString('uz-UZ', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          {/* Hodim actions */}
                          {user?.role === 'hodim' && order.status === 'navbatda' && (
                            <Button
                              size="sm"
                              onClick={() => handleUpdateStatus(order.id, 'yuvilmoqda')}
                              className="bg-[#0052FF] hover:bg-[#0043D1] text-white"
                              data-testid={`start-washing-${order.id}`}
                            >
                              Boshlash
                            </Button>
                          )}
                          {user?.role === 'hodim' && order.status === 'yuvilmoqda' && (
                            <Button
                              size="sm"
                              onClick={() => handleUpdateStatus(order.id, 'tugallandi')}
                              className="bg-[#047857] hover:bg-[#036147] text-white"
                              data-testid={`complete-washing-${order.id}`}
                            >
                              Tugallash
                            </Button>
                          )}

                          {/* Kassir/Admin payment */}
                          {(user?.role === 'kassir' || user?.role === 'super_admin') &&
                            order.status === 'tugallandi' &&
                            order.payment_status === 'kutilmoqda' && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setShowPaymentDialog(true);
                                }}
                                className="bg-[#047857] hover:bg-[#036147] text-white"
                                data-testid={`process-payment-${order.id}`}
                              >
                                To'lov qilish
                              </Button>
                            )}

                          {/* Admin can change any status */}
                          {user?.role === 'super_admin' && order.status !== 'tolandi' && (
                            <Select
                              value={order.status}
                              onValueChange={(value) => handleUpdateStatus(order.id, value)}
                            >
                              <SelectTrigger className="w-[130px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="navbatda">Navbatda</SelectItem>
                                <SelectItem value="yuvilmoqda">Yuvilmoqda</SelectItem>
                                <SelectItem value="tugallandi">Tugallandi</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold text-[#0A1128]">
                To'lov qabul qilish
              </DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <form onSubmit={handleProcessPayment} className="space-y-4">
                <div className="p-4 bg-[#F8FAFC] rounded-md">
                  <p className="text-sm text-[#475569] mb-1">Mashina</p>
                  <p className="font-semibold text-[#0A1128]">
                    {selectedOrder.license_plate} - {selectedOrder.brand}{' '}
                    {selectedOrder.model}
                  </p>
                  <p className="text-sm text-[#475569] mt-2 mb-1">Xizmat</p>
                  <p className="font-semibold text-[#0A1128]">
                    {selectedOrder.service_name}
                  </p>
                  <p className="text-sm text-[#475569] mt-2 mb-1">Narx</p>
                  <p className="text-2xl font-bold text-[#047857]">
                    {selectedOrder.price.toLocaleString()} so'm
                  </p>
                </div>

                <div>
                  <Label>To'lov usuli</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger data-testid="payment-method-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="naqd">Naqd</SelectItem>
                      <SelectItem value="karta">Karta</SelectItem>
                      <SelectItem value="click">Click</SelectItem>
                      <SelectItem value="payme">Payme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPaymentDialog(false)}
                  >
                    Bekor qilish
                  </Button>
                  <Button
                    type="submit"
                    className="bg-[#047857] hover:bg-[#036147] text-white"
                    data-testid="confirm-payment-button"
                  >
                    To'lovni qabul qilish
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
