import React, { useState, useEffect } from 'react';
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
import { Plus, Trash } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'hodim',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/users`, {
        withCredentials: true,
      });
      setUsers(data);
    } catch (error) {
      toast.error('Foydalanuvchilar yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/auth/register`, formData, {
        withCredentials: true,
      });
      toast.success('Foydalanuvchi qo\'shildi');
      setShowDialog(false);
      setFormData({ email: '', password: '', name: '', role: 'hodim' });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Xatolik yuz berdi');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Foydalanuvchini o\'chirmoqchimisiz?')) {
      try {
        await axios.delete(`${API_URL}/api/users/${id}`, {
          withCredentials: true,
        });
        toast.success('Foydalanuvchi o\'chirildi');
        fetchUsers();
      } catch (error) {
        toast.error('Xatolik yuz berdi');
      }
    }
  };

  const roleLabels = {
    super_admin: 'Super Admin',
    kassir: 'Kassir',
    hodim: 'Hodim',
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
              Foydalanuvchilar
            </h1>
            <p className="text-base text-[#475569]">Barcha foydalanuvchilar va ularning rollari</p>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button
                className="bg-[#0052FF] hover:bg-[#0043D1] text-white"
                data-testid="add-user-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Yangi Foydalanuvchi
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-2xl font-semibold text-[#0A1128]">
                  Yangi foydalanuvchi qo'shish
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Ism</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ism Familiya"
                    required
                    data-testid="user-name-input"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                    required
                    data-testid="user-email-input"
                  />
                </div>
                <div>
                  <Label>Parol</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="••••••••"
                    required
                    data-testid="user-password-input"
                  />
                </div>
                <div>
                  <Label>Rol</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger data-testid="user-role-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hodim">Hodim</SelectItem>
                      <SelectItem value="kassir">Kassir</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDialog(false)}
                  >
                    Bekor qilish
                  </Button>
                  <Button
                    type="submit"
                    className="bg-[#0052FF] hover:bg-[#0043D1] text-white"
                    data-testid="save-user-button"
                  >
                    Qo'shish
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="users-table">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                  <th className="text-left py-3 px-4">Ism</th>
                  <th className="text-left py-3 px-4">Email</th>
                  <th className="text-left py-3 px-4">Rol</th>
                  <th className="text-left py-3 px-4">Qo'shilgan sana</th>
                  <th className="text-left py-3 px-4">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-[#0A1128]">{user.name}</td>
                    <td className="py-3 px-4 text-[#475569]">{user.email}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-[#EFF6FF] text-[#0052FF] border-[#BFDBFE]">
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-[#475569]">
                      {new Date(user.created_at).toLocaleDateString('uz-UZ')}
                    </td>
                    <td className="py-3 px-4">
                      {user.role !== 'super_admin' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(user.id)}
                          data-testid={`delete-user-${user.id}`}
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
