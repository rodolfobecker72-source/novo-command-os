import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, ImageIcon, Plus, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  MAX_NEXT_STEPS, whatsappLink, type CornerStyle, type CoverStyle, type NextStepsSettings, type ProposalStyle,
} from '@/utils/proposalStyle';

export interface ProposalStyleOptions {
  proposalStyle: ProposalStyle;
  coverStyle: CoverStyle;
  coverImageUrl: string;
  cornerStyle: CornerStyle;
  nextSteps: NextStepsSettings;
  whatsapp: string;
}

interface Props {
  value: ProposalStyleOptions;
  onChange: (value: ProposalStyleOptions) => void;
  workspaceId: string;
  /** Brand colors (hex) for the small previews. */
  primary: string;
  highlight: string;
  onSample: () => void;
  sampleBusy: boolean;
}

/** Selectable tile with a small drawing of the option. */
function Tile({ selected, onClick, title, hint, children }: {
  selected: boolean; onClick: () => void; title: string; hint: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors',
        selected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'hover:border-primary/50',
      )}
    >
      {children}
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[11px] text-muted-foreground leading-tight">{hint}</p>
      </div>
    </button>
  );
}

/** Tiny A4 page used by the previews. */
function Page({ bg, children }: { bg: string; children?: React.ReactNode }) {
  return (
    <div className="relative w-14 h-[78px] rounded-sm border shadow-sm overflow-hidden" style={{ background: bg }}>
      {children}
    </div>
  );
}

export function ProposalStyleCard({ value, onChange, workspaceId, primary, highlight, onSample, sampleBusy }: Props) {
  const photoInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof ProposalStyleOptions>(key: K, v: ProposalStyleOptions[K]) => onChange({ ...value, [key]: v });
  const setSteps = (next: Partial<NextStepsSettings>) => set('nextSteps', { ...value.nextSteps, ...next });
  const modern = value.proposalStyle === 'moderno';
  const round = value.cornerStyle === 'arredondado' ? 'rounded-[3px]' : '';

  const uploadPhoto = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { toast.error('Envie uma imagem JPG, PNG ou WebP'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('A foto deve ter no máximo 8 MB'); return; }
    setUploading(true);
    try {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${workspaceId}/cover-photo.${ext}`;
      const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('logos').getPublicUrl(path);
      onChange({ ...value, coverStyle: 'foto', coverImageUrl: `${data.publicUrl}?t=${Date.now()}` });
      toast.success('Foto enviada! Clique em Salvar para aplicar.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar a foto');
    } finally {
      setUploading(false);
    }
  };

  const whatsappInvalid = value.whatsapp.trim() !== '' && !whatsappLink(value.whatsapp);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Estilo da proposta</CardTitle>
        <CardDescription>Escolha o visual do PDF. As cores vêm da identidade visual abaixo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Tile selected={!modern} onClick={() => set('proposalStyle', 'classico')} title="Clássico" hint="Capa branca e títulos em maiúsculas">
            <Page bg="#fff">
              <div className="absolute left-1.5 top-6 w-8 h-1.5" style={{ background: primary }} />
              <div className="absolute left-1.5 top-[30px] w-6 h-1.5" style={{ background: primary }} />
              <div className="absolute left-1.5 top-[38px] w-3 h-0.5" style={{ background: highlight }} />
              <div className="absolute left-1.5 right-1.5 bottom-3 h-px bg-neutral-300" />
            </Page>
          </Tile>
          <Tile selected={modern} onClick={() => set('proposalStyle', 'moderno')} title="Moderno" hint="Capa colorida, cartões e próximos passos">
            <Page bg={primary}>
              <div className="absolute left-1.5 top-7 w-9 h-1.5 bg-white/90 rounded-full" />
              <div className="absolute left-1.5 top-[34px] w-6 h-1 bg-white/60 rounded-full" />
              <div className="absolute left-1.5 top-[41px] w-3 h-0.5 rounded-full" style={{ background: highlight }} />
              <div className="absolute left-1.5 right-1.5 bottom-1.5 h-2 flex gap-0.5">
                {[0, 1, 2].map((i) => <div key={i} className="flex-1 bg-white/15 rounded-[2px]" />)}
              </div>
            </Page>
          </Tile>
        </div>

        {modern && (
          <>
            <div className="space-y-2">
              <Label>Capa</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['cor', 'Cor da marca', 'Fundo na cor principal'],
                  ['foto', 'Foto', 'Sua foto com a cor por cima'],
                  ['clara', 'Clara', 'Fundo branco'],
                ] as const).map(([key, title, hint]) => (
                  <Tile key={key} selected={value.coverStyle === key} onClick={() => set('coverStyle', key)} title={title} hint={hint}>
                    <Page bg={key === 'clara' ? '#fff' : primary}>
                      {key === 'foto' && (
                        <div className="absolute inset-0 opacity-40" style={{ background: value.coverImageUrl ? `center/cover url("${value.coverImageUrl}")` : 'linear-gradient(135deg,#d9a441,#3a2f28)' }} />
                      )}
                      <div className="absolute left-1.5 top-8 w-8 h-1.5 rounded-full" style={{ background: key === 'clara' ? primary : 'rgba(255,255,255,.9)' }} />
                      <div className="absolute left-1.5 top-[38px] w-3 h-0.5 rounded-full" style={{ background: highlight }} />
                    </Page>
                  </Tile>
                ))}
              </div>
              {value.coverStyle === 'foto' && (
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <div className="w-16 h-12 rounded border overflow-hidden bg-muted/40 flex items-center justify-center shrink-0">
                    {value.coverImageUrl
                      ? <img src={value.coverImageUrl} alt="Foto da capa" className="w-full h-full object-cover" />
                      : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Foto da capa</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">Uma foto do seu trabalho. JPG ou PNG, até 8 MB; a imagem é recortada para a página.</p>
                  </div>
                  <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { uploadPhoto(e.target.files?.[0]); e.target.value = ''; }} />
                  <Button variant="outline" size="sm" onClick={() => photoInput.current?.click()} disabled={uploading}>
                    <Upload className="w-4 h-4 mr-2" />{uploading ? 'Enviando...' : value.coverImageUrl ? 'Trocar' : 'Enviar'}
                  </Button>
                  {value.coverImageUrl && (
                    <Button variant="ghost" size="icon" aria-label="Remover foto" className="text-destructive hover:text-destructive" onClick={() => set('coverImageUrl', '')}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
              {value.coverStyle === 'foto' && !value.coverImageUrl && (
                <p className="text-xs text-muted-foreground">Sem foto, a capa sai só com a cor da marca.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Cantos das caixas</Label>
              <div className="grid grid-cols-2 gap-2">
                {([['arredondado', 'Arredondados'], ['reto', 'Retos']] as const).map(([key, title]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={value.cornerStyle === key}
                    onClick={() => set('cornerStyle', key)}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
                      value.cornerStyle === key ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'hover:border-primary/50',
                    )}
                  >
                    <span className={cn('w-5 h-4 border-2', key === 'arredondado' && 'rounded-md')} style={{ borderColor: primary }} />
                    {title}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Próximos passos</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">Fecha a proposta com o que acontece depois do sim e o seu contato.</p>
                </div>
                <Switch checked={value.nextSteps.enabled} onCheckedChange={(v) => setSteps({ enabled: v })} aria-label="Mostrar próximos passos" />
              </div>
              {value.nextSteps.enabled && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Título da seção</Label>
                    <Input value={value.nextSteps.title} onChange={(e) => setSteps({ title: e.target.value })} maxLength={40} />
                  </div>
                  {value.nextSteps.steps.map((step, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className={cn('mt-2 w-6 h-6 shrink-0 text-xs font-bold flex items-center justify-center rounded-full', round)} style={{ background: `${highlight}22`, color: highlight }}>{i + 1}</span>
                      <div className="flex-1 grid gap-1.5 sm:grid-cols-[1fr_2fr]">
                        <Input
                          value={step.title}
                          placeholder="Etapa"
                          maxLength={30}
                          aria-label={`Etapa ${i + 1}`}
                          onChange={(e) => setSteps({ steps: value.nextSteps.steps.map((s, j) => (j === i ? { ...s, title: e.target.value } : s)) })}
                        />
                        <Input
                          value={step.text}
                          placeholder="O que acontece nessa etapa"
                          maxLength={90}
                          aria-label={`Descrição da etapa ${i + 1}`}
                          onChange={(e) => setSteps({ steps: value.nextSteps.steps.map((s, j) => (j === i ? { ...s, text: e.target.value } : s)) })}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-0.5 shrink-0"
                        aria-label={`Remover etapa ${i + 1}`}
                        onClick={() => setSteps({ steps: value.nextSteps.steps.filter((_, j) => j !== i) })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {value.nextSteps.steps.length < MAX_NEXT_STEPS && (
                    <Button variant="outline" size="sm" onClick={() => setSteps({ steps: [...value.nextSteps.steps, { title: '', text: '' }] })}>
                      <Plus className="w-4 h-4 mr-2" />Adicionar etapa
                    </Button>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">WhatsApp do contato</Label>
                    <Input value={value.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="(11) 99999-0000" maxLength={30} inputMode="tel" />
                    <p className={cn('text-[11px] leading-tight', whatsappInvalid ? 'text-destructive' : 'text-muted-foreground')}>
                      {whatsappInvalid
                        ? 'Número incompleto: use DDD e número.'
                        : 'Aparece no cartão de contato com um QR code que abre a conversa. O nome é o do responsável pela proposta.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onSample} disabled={sampleBusy}>
            <Download className="w-4 h-4 mr-2" />
            {sampleBusy ? 'Gerando...' : 'Baixar PDF de exemplo'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
