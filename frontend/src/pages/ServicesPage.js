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
import { Plus, Edit, Trash } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    duration: '',
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/services`, {
        withCredentials: true,
      });
      setServices(data);
    } catch (error) {
      toast.error('Xizmatlar yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingService) {
        await axios.patch(
          `${API_URL}/api/services/${editingService.id}`,
          {
            name: formData.name,
            price: parseFloat(formData.price),
            duration: parseInt(formData.duration),
          },
          { withCredentials: true }
        );
        toast.success('Xizmat yangilandi');
      } else {
        await axios.post(
          `${API_URL}/api/services`,
          {
            name: formData.name,
            price: parseFloat(formData.price),
            duration: parseInt(formData.duration),
          },
          { withCredentials: true }
        );
        toast.success('Xizmat qo\'shildi');
      }
      setShowDialog(false);
      setEditingService(null);
      setFormData({ name: '', price: '', duration: '' });
      fetchServices();
    } catch (error) {
      toast.error('Xatolik yuz berdi');
    }
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      price: service.price.toString(),
      duration: service.duration.toString(),
    });
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Xizmatni o\'chirmoqchimisiz?')) {
      try {
        await axios.delete(`${API_URL}/api/services/${id}`, {
          withCredentials: true,
        });
        toast.success('Xizmat o\'chirildi');
        fetchServices();
      } catch (error) {
        toast.error('Xatolik yuz berdi');
      }
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0A1128] mb-2">
              Xizmatlar
            </h1>
            <p className="text-base text-[#475569]">Barcha xizmatlar va narxlar</p>
          </div>
          <Dialog
            open={showDialog}
            onOpenChange={(open) => {
              setShowDialog(open);
              if (!open) {
                setEditingService(null);
                setFormData({ name: '', price: '', duration: '' });
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                className="bg-[#0052FF] hover:bg-[#0043D1] text-white"
                data-testid="add-service-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Yangi Xizmat
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-2xl font-semibold text-[#0A1128]">
                  {editingService ? 'Xizmatni tahrirlash' : 'Yangi xizmat qo\'shish'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Nomi</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Oddiy yuvish"
                    required
                    data-testid="service-name-input"
                  />
                </div>
                <div>
                  <Label>Narx (so'm)</Label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="50000"
                    required
                    data-testid="service-price-input"
                  />
                </div>
                <div>
                  <Label>Davomiyligi (daqiqa)</Label>
                  <Input
                    type="number"
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData({ ...formData, duration: e.target.value })
                    }
                    placeholder="30"
                    required
                    data-testid="service-duration-input"
                  />
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
                    data-testid="save-service-button"
                  >
                    {editingService ? 'Saqlash' : 'Qo\'shish'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="services-table">
              <thead>
                <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                  <th className="text-left py-3 px-4">Nomi</th>
                  <th className="text-left py-3 px-4">Narx</th>
                  <th className="text-left py-3 px-4">Davomiyligi</th>
                  <th className="text-left py-3 px-4">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr
                    key={service.id}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-[#0A1128]">
                      {service.name}
                    </td>
                    <td className="py-3 px-4 text-[#047857] font-semibold">
                      {service.price.toLocaleString()} so'm
                    </td>
                    <td className="py-3 px-4 text-[#475569]">{service.duration} daqiqa</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(service)}
                          data-testid={`edit-service-${service.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(service.id)}
                          data-testid={`delete-service-${service.id}`}
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
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
