import { useState, useRef, useEffect } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GoogleCalendarConnect } from './GoogleCalendarConnect';
import { formatWhatsapp, maskWhatsappInput, normalizeWhatsapp } from '@/utils/whatsapp';

interface ProfileEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileEditDialog({ open, onOpenChange }: ProfileEditDialogProps) {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && profile) {
      setName(profile.name || '');
      setBirthDate(profile.birth_date || '');
      setWhatsapp(formatWhatsapp(profile.whatsapp));
      setWhatsappError(null);
      setPhotoPreview(profile.photo_url || null);
      setSelectedFile(null);
    }
  }, [open, profile]);

  const getInitials = (n: string) =>
    n.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Máximo de 5MB.', variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    const phone = normalizeWhatsapp(whatsapp);
    if (!phone.ok) {
      setWhatsappError(phone.error);
      return;
    }
    setSaving(true);

    try {
      let photoUrl = profile.photo_url;

      // Upload new photo if selected
      if (selectedFile) {
        const ext = selectedFile.name.split('.').pop() || 'jpg';
        const path = `${user.id}/avatar.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, selectedFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({ name: name.trim(), photo_url: photoUrl, birth_date: birthDate || null, whatsapp: phone.value })
        .eq('id', user.id);

      if (error) {
        if (error.code === '23505') {
          setWhatsappError('Este número já está cadastrado para outro usuário.');
          return;
        }
        throw error;
      }

      toast({ title: 'Perfil atualizado!' });
      onOpenChange(false);

      // Reload to reflect changes in AuthContext
      window.location.reload();
    } catch (err: any) {
      console.error('[ProfileEdit] Error:', err);
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Avatar className="w-24 h-24">
                <AvatarImage src={photoPreview || undefined} alt={name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {name ? getInitials(name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => fileInputRef.current?.click()}
            >
              Alterar foto
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="profile-name">Nome</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
            />
          </div>

          {/* Birth date */}
          <div className="space-y-2">
            <Label htmlFor="profile-birthdate">Data de nascimento</Label>
            <Input
              id="profile-birthdate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>

          {/* WhatsApp */}
          <div className="space-y-2">
            <Label htmlFor="profile-whatsapp">WhatsApp</Label>
            <Input
              id="profile-whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              value={whatsapp}
              onChange={(e) => {
                setWhatsapp(maskWhatsappInput(e.target.value));
                setWhatsappError(null);
              }}
              onBlur={() => {
                const r = normalizeWhatsapp(whatsapp);
                if (!r.ok) setWhatsappError(r.error);
              }}
              placeholder="(35) 99999-8888"
              aria-invalid={!!whatsappError}
              className={whatsappError ? 'border-destructive' : undefined}
            />
            {whatsappError ? (
              <p className="text-xs text-destructive">{whatsappError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Número com DDD. Será usado em integrações com o WhatsApp.</p>
            )}
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={user?.email || ''} disabled className="bg-muted" />
          </div>

          {/* Google Calendar */}
          <GoogleCalendarConnect />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
