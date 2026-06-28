import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Car,
  DollarSign,
  Clock,
  CheckCircle,
  Users,
  TrendingUp,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const StatCard = ({ title, value, subtitle, icon: Icon, colorClass }) => (
  <div
    className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm transition-all duration-200 hover:border-blue-200"
    data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, '-')}`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">
          {title}
        </p>
        <p className="text-4xl font-black tracking-tighter text-[#0A1128] mb-1">
          {value}
        </p>
        {subtitle && <p className="text-sm text-[#475569]">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-md ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/dashboard/stats`, {
        withCredentials: true,
      });
      setStats(data);
    } catch (error) {
      toast.error('Statistika yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052FF]"></div>
        </div>
      </Layout>
    );
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0A1128] mb-2">
            Dashboard
          </h1>
          <p className="text-base text-[#475569]">
            {user?.role === 'super_admin'
              ? 'Barcha statistika va hisobotlar'
              : user?.role === 'kassir'
              ? 'Bugungi moliyaviy ma\'lumotlar'
              : 'Sizning statistikangiz'}
          </p>
        </div>

        {/* Super Admin Stats */}
        {user?.role === 'super_admin' && stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Bugungi mashinalar"
                value={stats.today_orders}
                subtitle="Jami kelgan"
                icon={Car}
                colorClass="bg-[#DBEAFE] text-[#1D4ED8]"
              />
              <StatCard
                title="Bugungi daromad"
                value={formatCurrency(stats.today_revenue)}
                icon={DollarSign}
                colorClass="bg-[#D1FAE5] text-[#047857]"
              />
              <StatCard
                title="Haftalik daromad"
                value={formatCurrency(stats.weekly_revenue)}
                icon={TrendingUp}
                colorClass="bg-[#FEF3C7] text-[#B45309]"
              />
              <StatCard
                title="Oylik daromad"
                value={formatCurrency(stats.monthly_revenue)}
                icon={DollarSign}
                colorClass="bg-[#EFF6FF] text-[#0052FF]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Navbatda"
                value={stats.waiting_orders}
                subtitle="Kutayotgan"
                icon={Clock}
                colorClass="bg-[#FEF3C7] text-[#B45309]"
              />
              <StatCard
                title="Yuvilmoqda"
                value={stats.washing_orders}
                subtitle="Jarayonda"
                icon={Car}
                colorClass="bg-[#DBEAFE] text-[#1D4ED8]"
              />
              <StatCard
                title="Tugallandi"
                value={stats.completed_orders}
                subtitle="Bajarilgan"
                icon={CheckCircle}
                colorClass="bg-[#D1FAE5] text-[#047857]"
              />
              <StatCard
                title="To'lanmagan"
                value={stats.unpaid_orders}
                subtitle="Kutilmoqda"
                icon={DollarSign}
                colorClass="bg-[#FEE2E2] text-[#DC2626]"
              />
            </div>

            {/* Employee Performance */}
            {stats.employee_stats && stats.employee_stats.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                <h2 className="text-2xl font-semibold text-[#0A1128] mb-6">
                  Hodimlar statistikasi
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                        <th className="text-left py-3 px-4">Hodim</th>
                        <th className="text-right py-3 px-4">Mashinalar</th>
                        <th className="text-right py-3 px-4">Daromad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.employee_stats.map((emp) => (
                        <tr
                          key={emp.id}
                          className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium text-[#0A1128]">
                            {emp.name}
                          </td>
                          <td className="py-3 px-4 text-right text-[#475569]">
                            {emp.total_cars}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-[#047857]">
                            {formatCurrency(emp.total_revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Kassir Stats */}
        {user?.role === 'kassir' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Bugungi mashinalar"
              value={stats.today_orders}
              icon={Car}
              colorClass="bg-[#DBEAFE] text-[#1D4ED8]"
            />
            <StatCard
              title="Bugungi daromad"
              value={formatCurrency(stats.today_revenue)}
              icon={DollarSign}
              colorClass="bg-[#D1FAE5] text-[#047857]"
            />
            <StatCard
              title="To'lov kutilmoqda"
              value={stats.pending_payment}
              subtitle="Mashinalar"
              icon={Clock}
              colorClass="bg-[#FEF3C7] text-[#B45309]"
            />
          </div>
        )}

        {/* Hodim Stats */}
        {user?.role === 'hodim' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Bugungi mashinalar"
              value={stats.today_cars}
              subtitle="Yuvilgan"
              icon={Car}
              colorClass="bg-[#DBEAFE] text-[#1D4ED8]"
            />
            <StatCard
              title="Bugun ishlangan"
              value={formatCurrency(stats.today_earnings)}
              icon={DollarSign}
              colorClass="bg-[#D1FAE5] text-[#047857]"
            />
            <StatCard
              title="Mening buyurtmalarim"
              value={stats.my_orders}
              subtitle="Faol"
              icon={Clock}
              colorClass="bg-[#FEF3C7] text-[#B45309]"
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
