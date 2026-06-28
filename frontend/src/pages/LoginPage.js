import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      toast.success('Tizimga muvaffaqiyatli kirdingiz!');
      navigate('/');
    } else {
      toast.error(result.error || 'Login xato. Qaytadan urinib ko\'ring.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0A1128] mb-2">
              Avtomoyka Tizimi
            </h1>
            <p className="text-base text-[#475569]">
              Hisobingizga kiring va boshqaruvni boshlang
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-[#0A1128]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@avtomoyka.uz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email-input"
                className="bg-white border-slate-200 focus:border-[#0052FF] focus:ring-[#0052FF]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-[#0A1128]">
                Parol
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="login-password-input"
                className="bg-white border-slate-200 focus:border-[#0052FF] focus:ring-[#0052FF]"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0052FF] hover:bg-[#0043D1] text-white font-medium py-6 rounded-md transition-colors"
              data-testid="login-submit-button"
            >
              {loading ? 'Tekshirilmoqda...' : 'Kirish'}
            </Button>
          </form>

          <div className="mt-8 p-4 bg-[#EFF6FF] rounded-md border border-[#BFDBFE]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#1D4ED8] mb-2">
              Test Hisoblar
            </p>
            <div className="space-y-1 text-sm text-[#475569]">
              <p>Admin: admin@avtomoyka.uz / Admin123!</p>
              <p>Kassir: kassir@avtomoyka.uz / Kassir123!</p>
              <p>Hodim: hodim@avtomoyka.uz / Hodim123!</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Image */}
      <div
        className="hidden lg:block lg:w-1/2 bg-cover bg-center relative"
        style={{
          backgroundImage:
            'url(https://images.unsplash.com/photo-1664732145436-b1cc8becac37?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2ODh8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBjYXIlMjB3YXNoJTIwd2F0ZXIlMjBkcm9wcyUyMGFic3RyYWN0fGVufDB8fHx8MTc4MjY0NDg5Nnww&ixlib=rb-4.1.0&q=85)',
        }}
      >
        <div className="absolute inset-0 bg-[#0A1128]/60 backdrop-blur-sm"></div>
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="text-center">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Zamonaviy Boshqaruv
            </h2>
            <p className="text-lg text-white/90">
              Avtomoykangizdagi barcha jarayonlarni bitta tizimda boshqaring
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
