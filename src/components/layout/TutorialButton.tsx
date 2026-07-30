import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CirclePlay, Clapperboard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getTutorialForPath } from '@/config/tutorials';

interface TutorialButtonProps {
  /** Sobrescreve o título exibido no diálogo (opcional) */
  fallbackTitle?: string;
}

export function TutorialButton({ fallbackTitle }: TutorialButtonProps) {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const tutorial = getTutorialForPath(location.pathname);

  const title = tutorial?.title || fallbackTitle || 'Tutorial desta página';
  const description =
    tutorial?.description || 'Um guia em vídeo desta área estará disponível em breve.';

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl text-muted-foreground hover:text-primary"
              onClick={() => setOpen(true)}
              aria-label="Ver tutorial desta página"
            >
              <CirclePlay className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Tutorial desta página</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="rounded-xl overflow-hidden border border-border bg-muted/40 aspect-video flex items-center justify-center">
            {tutorial?.videoUrl ? (
              <iframe
                src={tutorial.videoUrl}
                title={title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="text-center px-6 py-8 space-y-2">
                <Clapperboard className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Vídeo em produção</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Em breve você poderá assistir ao passo a passo desta página por aqui.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
