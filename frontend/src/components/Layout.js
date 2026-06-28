import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import {
  LayoutDashboard,
  Car,
  Package,
  Users,
  FileText,
  LogOut,
} from 'lucide-react';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['super_admin', 'kassir', 'hodim'] },
    { name: 'Buyurtmalar', href: '/orders', icon: Car, roles: ['super_admin', 'kassir', 'hodim'] },
    { name: 'Xizmatlar', href: '/services', icon: Package, roles: ['super_admin'] },
    { name: 'Foydalanuvchilar', href: '/users', icon: Users, roles: ['super_admin'] },
    { name: 'Hisobotlar', href: '/reports', icon: FileText, roles: ['super_admin', 'kassir'] },
  ];

  const filteredNav = navigation.filter((item) => item.roles.includes(user?.role));

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-2xl font-bold text-[#0A1128] tracking-tight">
            Avtomoyka
          </h1>
          <p className="text-sm text-[#94A3B8] mt-1">
            {user?.role === 'super_admin'
              ? 'Super Admin'
              : user?.role === 'kassir'
              ? 'Kassir'
              : 'Hodim'}
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-md font-medium transition-colors ${
                  isActive
                    ? 'bg-[#EFF6FF] text-[#0052FF] border border-[#BFDBFE]'
                    : 'text-[#475569] hover:bg-[#F1F5F9]'
                }`}
                data-testid={`nav-${item.name.toLowerCase()}`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="mb-3 px-4 py-3 bg-[#F8FAFC] rounded-md">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-1">
              Foydalanuvchi
            </p>
            <p className="text-sm font-medium text-[#0A1128]">{user?.name}</p>
            <p className="text-xs text-[#475569]">{user?.email}</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full justify-start gap-2 text-[#0A1128] hover:bg-[#F1F5F9]"
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4" />
            Chiqish
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
