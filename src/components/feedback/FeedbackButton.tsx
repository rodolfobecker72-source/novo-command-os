import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertCircle, ImagePlus, Loader2, Star, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TYPES = [
  { value: 'bug', label: 'Reportar um erro (bug)' },
  { value: 'sugestao', label: 'Sugestão de melhoria' },
  { value: 'avaliacao', label: 'Avaliação do sistema' },
];

const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024;

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { user, profile, workspace } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);

  const setOpen = onOpenChange;
  const [type, setType] = useState('sugestao');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const reset = () => {
    setType('sugestao');
    setRating(0);
    setMessage('');
    setFiles([]);
  };

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).filter((f) => {
      if (!f.type.startsWith('image/')) {
        toast({ title: 'Arquivo inválido', description: `${f.name} não é uma imagem.`, variant: 'destructive' });
        return false;
      }
      if (f.size > MAX_SIZE) {
        toast({ title: 'Imagem muito grande', description: `${f.name} passa de 5MB.`, variant: 'destructive' });
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...picked].slice(0, MAX_FILES));
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast({ title: 'Escreva uma mensagem', description: 'Descreva o erro, sugestão ou avaliação.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const paths: string[] = [];
      for (const file of files) {
        const ext = file.name.split('.').pop() || 'png';
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from('feedback-images').upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) throw error;
        paths.push(path);
      }

      const { error: insertError } = await supabase.from('feedback_reports').insert({
        workspace_id: workspace?.id ?? null,
        user_id: user.id,
        user_name: profile?.name || user.email || '',
        workspace_name: workspace?.name || '',
        page_path: location.pathname,
        type,
        rating: type === 'avaliacao' && rating > 0 ? rating : null,
        message: message.trim(),
        images: paths,
      });
      if (insertError) throw insertError;

      toast({ title: 'Obrigado!', description: 'Seu report foi enviado com sucesso.' });
      reset();
      setOpen(false);
    } catch (err: any) {
      console.error('[Feedback] erro ao enviar:', err);
      toast({ title: 'Erro ao enviar', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reports, sugestões e avaliações</DialogTitle>
            <DialogDescription>
              {profile?.name || 'Usuário'}
              {workspace?.name ? ` · ${workspace.name}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {type === 'avaliacao' && (
              <div className="space-y-2">
                <Label>Sua nota</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      aria-label={`Nota ${n}`}
                      className="p-1"
                    >
                      <Star className={`w-6 h-6 ${n <= rating ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Mensagem *</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="Descreva o que aconteceu ou sua sugestão de melhoria..."
              />
            </div>

            <div className="space-y-2">
              <Label>Imagens (opcional)</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={files.length >= MAX_FILES}
                className="w-full"
              >
                <ImagePlus className="w-4 h-4 mr-2" />
                Anexar imagens ({files.length}/{MAX_FILES})
              </Button>

              {files.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="relative rounded-lg overflow-hidden border border-border">
                      <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-20 object-cover" />
                      <button
                        type="button"
                        aria-label="Remover imagem"
                        onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 bg-background/90 rounded-full p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
