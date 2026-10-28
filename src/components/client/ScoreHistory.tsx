import { motion } from 'framer-motion';
import { History, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScoreBadge } from '@/components/common/ScoreBadge';

export interface ScoreHistoryEntry {
  id: string;
  clientId: string;
  score: number;
  previousScore: number;
  reason: string;
  timestamp: Date;
}

interface ScoreHistoryProps {
  history: ScoreHistoryEntry[];
}

export function ScoreHistory({ history }: ScoreHistoryProps) {
  if (history.length === 0) {
    return (
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-accent" />
            <CardTitle className="text-base">Histórico do Score</CardTitle>
          </div>
          <CardDescription>Evolução do Client Score</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-6 text-center text-muted-foreground border rounded-lg">
            <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma alteração de score registrada ainda.</p>
            <p className="text-xs mt-1">O histórico será atualizado automaticamente conforme o CRM evolui.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-elevated">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-accent" />
          <CardTitle className="text-base">Histórico do Score</CardTitle>
        </div>
        <CardDescription>
          {history.length} alteração(ões) registrada(s)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {history.map((entry, index) => {
            const diff = entry.score - entry.previousScore;
            const isPositive = diff > 0;
            const isNegative = diff < 0;
            const isNeutral = diff === 0;

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-4 py-3 border-b last:border-b-0"
              >
                {/* Timeline dot */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isPositive
                        ? 'bg-success'
                        : isNegative
                        ? 'bg-destructive'
                        : 'bg-muted-foreground'
                    }`}
                  />
                  {index < history.length - 1 && (
                    <div className="w-0.5 h-full min-h-[20px] bg-border mt-1" />
                  )}
                </div>

                {/* Score change indicator */}
                <div className="flex items-center gap-2 min-w-[80px]">
                  <ScoreBadge score={entry.score} size="sm" />
                  <div className="flex items-center gap-0.5">
                    {isPositive && (
                      <>
                        <TrendingUp className="w-3 h-3 text-success" />
                        <span className="text-xs font-medium text-success">
                          +{diff}
                        </span>
                      </>
                    )}
                    {isNegative && (
                      <>
                        <TrendingDown className="w-3 h-3 text-destructive" />
                        <span className="text-xs font-medium text-destructive">
                          {diff}
                        </span>
                      </>
                    )}
                    {isNeutral && (
                      <>
                        <Minus className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">
                          0
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Reason and date */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
