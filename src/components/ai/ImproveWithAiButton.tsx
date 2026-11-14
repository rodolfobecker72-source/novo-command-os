import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { invokeFunction } from '@/lib/edgeFunctions';

interface Props {
  /** Current text of the field */
  text: string;
  /** Which proposal field it is: the overall briefing or one service's description */
  kind: 'briefing' | 'service';
  /** Service name (CINE, FOTO, …) when kind is 'service' */
  serviceName?: string;
  /** Objective label of the service ("Cobertura de Evento"), when kind is 'service' */
  objective?: string;
  /** Project name, gives the AI context for the opening sentence */
  projectName?: string;
  /** Called with the text the user chose to keep */
  onAccept: (text: string) => void;
}

const MIN_CHARS = 10;

/**
 * "Melhorar com IA": sends the text to the backend, shows the suggestion next to
 * the original and only replaces the field when the user accepts it.
 */
export function ImproveWithAiButton({ text, kind, serviceName, objective, projectName, onAccept }: Props) {
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [original, setOriginal] = useState('');

  const improve = async () => {
    const current = text.trim();
    if (current.length < MIN_CHARS) {
      toast.info('Escreva um pouco mais antes de pedir a melhoria.');
      return;
    }
    setBusy(true);
    const { data, error } = await invokeFunction<{ text: string }>('ai-improve-text', {
      body: { text: current, kind, serviceName, objective, projectName },
    });
    setBusy(false);
    if (error || !data?.text) {
      toast.error(error?.message ?? 'Não foi possível melhorar o texto.');
      return;
    }
    setOriginal(current);
    setSuggestion(data.text);
  };

  const close = () => setSuggestion(null);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-accent hover:text-accent"
        onClick={improve}
        disabled={busy}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
        {busy ? 'Melhorando…' : 'Melhorar com IA'}
      </Button>

      <Dialog open={suggestion !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Texto melhorado com IA</DialogTitle>
            <DialogDescription>
              Confira se todas as informações continuam certas. Você pode ajustar a sugestão antes de usar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Seu texto</p>
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap max-h-80 overflow-y-auto">
                {original}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-accent flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Sugestão
              </p>
              <Textarea
                value={suggestion ?? ''}
                onChange={(e) => setSuggestion(e.target.value)}
                rows={12}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={close}>Manter o meu</Button>
            <Button
              onClick={() => {
                if (suggestion?.trim()) onAccept(suggestion.trim());
                close();
              }}
            >
              Usar este texto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
