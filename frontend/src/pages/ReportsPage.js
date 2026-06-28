import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Download, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ReportsPage() {
  const { user } = useAuth();
  const [todayReport, setTodayReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayReport();
  }, []);

  const fetchTodayReport = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/reports/today`, {
        withCredentials: true,
      });
      setTodayReport(data);
    } catch (error) {
      toast.error('Hisobot yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDay = async () => {
    if (
      window.confirm(
        'Kunni yopmoqchimisiz? Yopilgandan keyin ma\'lumotlar o\'zgartirilmaydi.'
      )
    ) {
      try {
        await axios.post(`${API_URL}/api/reports/close-day`, {}, { withCredentials: true });
        toast.success('Kun muvaffaqiyatli yopildi');
        fetchTodayReport();
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Xatolik yuz berdi');
      }
    }
  };

  const handleExportExcel = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await axios.get(
        `${API_URL}/api/reports/export/excel?start_date=${today}&end_date=${today}`,
        {
          withCredentials: true,
          responseType: 'blob',
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `hisobot_${today}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Hisobot yuklab olindi');
    } catch (error) {
      toast.error('Yuklab olishda xatolik');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0A1128] mb-2">
              Hisobotlar
            </h1>
            <p className="text-base text-[#475569]">Bugungi moliyaviy hisobot</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleExportExcel}
              variant="outline"
              className="gap-2"
              data-testid="export-excel-button"
            >
              <Download className="w-4 h-4" />
              Excel yuklab olish
            </Button>
            {user?.role === 'super_admin' && (
              <Button
                onClick={handleCloseDay}
                className="bg-[#0A1128] hover:bg-[#1a1f3a] text-white gap-2"
                data-testid="close-day-button"
              >
                <XCircle className="w-4 h-4" />
                Kunni yopish
              </Button>
            )}
          </div>
        </div>

        {todayReport && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">
                  Jami mashinalar
                </p>
                <p className="text-4xl font-black tracking-tighter text-[#0A1128]">
                  {todayReport.total_cars}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">
                  Jami tushum
                </p>
                <p className="text-2xl font-black tracking-tighter text-[#047857]">
                  {formatCurrency(todayReport.total_revenue)}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">
                  Naqd
                </p>
                <p className="text-xl font-black tracking-tighter text-[#0A1128]">
                  {formatCurrency(todayReport.cash)}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">
                  Karta
                </p>
                <p className="text-xl font-black tracking-tighter text-[#0A1128]">
                  {formatCurrency(todayReport.card)}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] mb-2">
                  Click + Payme
                </p>
                <p className="text-xl font-black tracking-tighter text-[#0A1128]">
                  {formatCurrency(todayReport.click + todayReport.payme)}
                </p>
              </div>
            </div>

            {/* Employee Performance */}
            {todayReport.employee_stats && todayReport.employee_stats.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                <h2 className="text-2xl font-semibold text-[#0A1128] mb-6">
                  Bugungi hodimlar statistikasi
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full" data-testid="employee-stats-table">
                    <thead>
                      <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                        <th className="text-left py-3 px-4">Hodim</th>
                        <th className="text-right py-3 px-4">Yuvilgan mashinalar</th>
                        <th className="text-right py-3 px-4">Ishlab topilgan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayReport.employee_stats.map((emp) => (
                        <tr
                          key={emp.id}
                          className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="py-3 px-4 font-semibold text-[#0A1128]">
                            {emp.name}
                          </td>
                          <td className="py-3 px-4 text-right text-[#475569]">
                            {emp.cars_washed}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-[#047857]">
                            {formatCurrency(emp.earnings)}
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
      </div>
    </Layout>
  );
}
