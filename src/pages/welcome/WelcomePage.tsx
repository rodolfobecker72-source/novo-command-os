import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Cake, Sparkles, AlertTriangle, Play, Calendar, Target, AtSign, Check, StickyNote, Sun, Moon, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { toast } from '@/hooks/use-toast';
import { ProjectActivitiesDialog } from '@/components/projects/ProjectActivitiesDialog';

interface BirthdayMember {
  id: string;
  name: string;
  photo_url: string | null;
  day: number;
  month: number;
  weekday: string;
}

interface ActivityItem {
  id: string;
  title: string;
  dueDate: string | null;
  projectName: string;
  projectCardId: string;
  isOverdue: boolean;
  isToday: boolean;
  freelaName: string | null;
}

interface UserActivities {
  userId: string;
  name: string;
  photoUrl: string | null;
  naoIniciado: ActivityItem[];
  emAndamento: ActivityItem[];
}

type LeadAlertStatus = 'overdue' | 'today' | 'upcoming';
interface LeadAlertItem {
  id: string;
  companyName: string;
  nextAction: string;
  nextActionDate: string;
  status: LeadAlertStatus;
}

interface MentionItem {
  cardId: string;
  commentId: string;
  projectName: string;
  authorName: string;
  authorPhoto: string | null;
  text: string;
  createdAt: string;
}

interface PersonalNoteItem {
  id: string;
  date: string; // yyyy-MM-dd
  content: string;
  isToday: boolean;
}

function formatDateBR(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function getGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Returns today (start) and today + 5 days (end)
function getUpcomingRange(ref: Date) {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 5);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function WelcomePage() {
  const { profile, workspace, hasPageAccess } = useAuth();
  const navigate = useNavigate();
  const [birthdays, setBirthdays] = useState<BirthdayMember[]>([]);
  const [userActivities, setUserActivities] = useState<UserActivities[]>([]);
  const [leadAlerts, setLeadAlerts] = useState<LeadAlertItem[]>([]);
  const [mentions, setMentions] = useState<MentionItem[]>([]);
  const [personalNotes, setPersonalNotes] = useState<PersonalNoteItem[]>([]);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [activityDialog, setActivityDialog] = useState<{ projectCardId: string; projectName: string } | null>(null);

  // Opens the project inside the Área de Projetos screen (full project view).
  // Falls back to the activities panel when the user has no access there.
  const openProject = (projectCardId: string, projectName: string) => {
    if (!projectCardId) return;
    if (hasPageAccess('gestao-projetos')) {
      navigate(`/gestao-projetos?projeto=${encodeURIComponent(projectCardId)}`);
    } else {
      setActivityDialog({ projectCardId, projectName });
    }
  };

  useRealtimeSync({
    workspaceId: workspace?.id,
    tables: ['project_activities', 'project_cards', 'prospection_leads', 'calendar_notes'],
    onChange: () => setReloadNonce(n => n + 1),
  });

  const now = new Date();
  const greeting = getGreeting(now.getHours());
  const firstName = profile?.name?.split(' ')[0] ?? '';
  const formattedDate = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    let cancelled = false;
    const loadBirthdays = async () => {
      if (!workspace) return;
      const { data: members } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', workspace.id);
      if (!members || members.length === 0) {
        if (!cancelled) setBirthdays([]);
        return;
      }
      const userIds = members.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, photo_url, birth_date')
        .in('id', userIds)
        .not('birth_date', 'is', null);

      const { start, end } = getUpcomingRange(now);
      const year = now.getFullYear();

      const list: BirthdayMember[] = (profiles || [])
        .map((p: any) => {
          if (!p.birth_date) return null;
          const dt = new Date(p.birth_date + 'T12:00:00');
          // Build this year's birthday occurrence
          const occ = new Date(year, dt.getMonth(), dt.getDate(), 12, 0, 0);
          if (occ < start || occ > end) return null;
          return {
            id: p.id,
            name: p.name,
            photo_url: p.photo_url,
            day: dt.getDate(),
            month: dt.getMonth() + 1,
            weekday: occ.toLocaleDateString('pt-BR', { weekday: 'long' }),
          } as BirthdayMember;
        })
        .filter(Boolean) as BirthdayMember[];

      list.sort((a, b) => a.day - b.day);
      if (!cancelled) setBirthdays(list);
    };
    loadBirthdays();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadActivities = async () => {
      if (!workspace || !profile?.id) return;
      const today = new Date().toISOString().slice(0, 10);
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 7);
      const horizonStr = horizon.toISOString().slice(0, 10);

      const { data: activities } = await supabase
        .from('project_activities')
      .select('id, title, status, due_date, assigned_to_user_id, assigned_to_user_ids, project_card_id, freela_name')
        .eq('workspace_id', workspace.id)
        .or(`assigned_to_user_id.eq.${profile.id},assigned_to_user_ids.cs.{${profile.id}}`)
        .neq('status', 'concluido');

      if (!activities || activities.length === 0) {
        if (!cancelled) setUserActivities([]);
        return;
      }

      const cardIds = Array.from(new Set(activities.map((a: any) => a.project_card_id).filter(Boolean)));

      const [{ data: cards }, { data: prof }] = await Promise.all([
        cardIds.length
          ? supabase.from('project_cards').select('id, project_name').in('id', cardIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('profiles').select('id, name, photo_url').eq('id', profile.id).maybeSingle(),
      ]);

      const cardMap = new Map((cards || []).map((c: any) => [c.id, c.project_name]));
      const me = prof as any;
      if (!me) {
        if (!cancelled) setUserActivities([]);
        return;
      }

      const bucket: UserActivities = {
        userId: profile.id,
        name: me.name || 'Sem nome',
        photoUrl: me.photo_url || null,
        naoIniciado: [],
        emAndamento: [],
      };

      for (const a of activities as any[]) {
        const ids: string[] = Array.isArray(a.assigned_to_user_ids) && a.assigned_to_user_ids.length > 0
          ? a.assigned_to_user_ids
          : (a.assigned_to_user_id ? [a.assigned_to_user_id] : []);
        if (!ids.includes(profile.id)) continue;
        const item: ActivityItem = {
          id: a.id,
          title: a.title,
          dueDate: a.due_date,
          projectName: cardMap.get(a.project_card_id) || 'Projeto',
          projectCardId: a.project_card_id,
          isOverdue: !!a.due_date && a.due_date < today,
          isToday: !!a.due_date && a.due_date === today,
          freelaName: a.freela_name || null,
        };
        if (a.status === 'em_andamento') bucket.emAndamento.push(item);
        else {
          // Não iniciadas: só mostrar com 7 dias de antecedência (ou já vencidas)
          if (a.due_date && a.due_date <= horizonStr) bucket.naoIniciado.push(item);
        }
      }

      const list = (bucket.naoIniciado.length > 0 || bucket.emAndamento.length > 0) ? [bucket] : [];

      if (!cancelled) setUserActivities(list);
    };
    loadActivities();
    return () => { cancelled = true; };
  }, [workspace?.id, profile?.id, reloadNonce]);

  useEffect(() => {
    let cancelled = false;
    const loadLeadAlerts = async () => {
      if (!workspace || !profile?.id) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().slice(0, 10);
      const horizon = new Date(today);
      horizon.setDate(horizon.getDate() + 5);
      const horizonStr = horizon.toISOString().slice(0, 10);

      const { data: leads } = await supabase
        .from('prospection_leads')
        .select('id, company_name, next_action, next_action_date, funnel_status, responsible_user_id')
        .eq('workspace_id', workspace.id)
        .eq('responsible_user_id', profile.id);

      const items: LeadAlertItem[] = [];
      for (const l of (leads || []) as any[]) {
        if (['perdido', 'qualificado_crm'].includes(l.funnel_status)) continue;
        const d = (l.next_action_date || '').slice(0, 10);
        if (!d) continue;
        let status: LeadAlertStatus | null = null;
        if (d < todayStr) status = 'overdue';
        else if (d === todayStr) status = 'today';
        else if (d <= horizonStr) status = 'upcoming';
        if (!status) continue;
        items.push({
          id: l.id,
          companyName: l.company_name,
          nextAction: l.next_action || '',
          nextActionDate: d,
          status,
        });
      }
      const order: Record<LeadAlertStatus, number> = { overdue: 0, today: 1, upcoming: 2 };
      items.sort((a, b) => order[a.status] - order[b.status] || a.nextActionDate.localeCompare(b.nextActionDate));
      if (!cancelled) setLeadAlerts(items);
    };
    loadLeadAlerts();
    return () => { cancelled = true; };
  }, [workspace?.id, profile?.id, reloadNonce]);

  useEffect(() => {
    let cancelled = false;
    const loadMentions = async () => {
      if (!workspace || !profile?.id) return;
      const { data: cards } = await supabase
        .from('project_cards')
        .select('id, project_name, comments')
        .eq('workspace_id', workspace.id);
      const items: MentionItem[] = [];
      for (const c of (cards || []) as any[]) {
        const arr = Array.isArray(c.comments) ? c.comments : [];
        for (const cm of arr) {
          const ments: string[] = Array.isArray(cm?.mentions) ? cm.mentions : [];
          const readBy: string[] = Array.isArray(cm?.readBy) ? cm.readBy : [];
          if (ments.includes(profile.id) && !readBy.includes(profile.id)) {
            items.push({
              cardId: c.id,
              commentId: cm.id,
              projectName: c.project_name || 'Projeto',
              authorName: cm.userName || 'Usuário',
              authorPhoto: cm.photoUrl || null,
              text: cm.text || '',
              createdAt: cm.createdAt || '',
            });
          }
        }
      }
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (!cancelled) setMentions(items);
    };
    loadMentions();
    return () => { cancelled = true; };
  }, [workspace?.id, profile?.id, reloadNonce]);

  useEffect(() => {
    let cancelled = false;
    const loadNotes = async () => {
      if (!workspace || !profile?.id) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().slice(0, 10);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);
      const { data } = await supabase
        .from('calendar_notes' as any)
        .select('id, date, content')
        .eq('user_id', profile.id)
        .eq('workspace_id', workspace.id)
        .in('date', [todayStr, tomorrowStr]);
      const items: PersonalNoteItem[] = ((data || []) as any[])
        .map(n => ({ id: n.id, date: n.date, content: n.content, isToday: n.date === todayStr }))
        .sort((a, b) => (a.isToday === b.isToday ? 0 : a.isToday ? -1 : 1));
      if (!cancelled) setPersonalNotes(items);
    };
    loadNotes();
    return () => { cancelled = true; };
  }, [workspace?.id, profile?.id, reloadNonce]);


  const handleMarkMentionRead = async (cardId: string, commentId: string) => {
    if (!profile?.id) return;
    const prev = mentions;
    setMentions(p => p.filter(m => !(m.cardId === cardId && m.commentId === commentId)));
    const { data: card } = await supabase
      .from('project_cards')
      .select('comments')
      .eq('id', cardId)
      .maybeSingle();
    const arr = Array.isArray((card as any)?.comments) ? (card as any).comments : [];
    const next = arr.map((cm: any) => {
      if (cm.id !== commentId) return cm;
      const readBy: string[] = Array.isArray(cm.readBy) ? cm.readBy : [];
      if (readBy.includes(profile.id)) return cm;
      return { ...cm, readBy: [...readBy, profile.id] };
    });
    const { error } = await supabase
      .from('project_cards')
      .update({ comments: next as any })
      .eq('id', cardId);
    if (error) {
      setMentions(prev);
      toast({ title: 'Erro', description: 'Não foi possível marcar como lido.', variant: 'destructive' });
    }
  };

  const handleCompleteActivity = async (activityId: string) => {
    // Optimistic remove
    setUserActivities((prev) =>
      prev
        .map((u) => ({
          ...u,
          naoIniciado: u.naoIniciado.filter((a) => a.id !== activityId),
          emAndamento: u.emAndamento.filter((a) => a.id !== activityId),
        }))
        .filter((u) => u.naoIniciado.length > 0 || u.emAndamento.length > 0)
    );
    const { error } = await supabase
      .from('project_activities')
      .update({ status: 'concluido' })
      .eq('id', activityId);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível concluir a tarefa.', variant: 'destructive' });
    } else {
      toast({ title: 'Tarefa concluída' });
    }
  };

  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <div className="min-h-screen bg-background">
      <Header title="Boas-vindas" />
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        {/* Saudação */}
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 md:w-7 md:h-7 shrink-0 mt-1 opacity-90" />
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {greeting}{firstName ? `, ${firstName}` : ''}!
                </h2>
                <p className="text-sm md:text-base mt-1 opacity-90 capitalize">
                  {formattedDate}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsDark((v) => !v)}
                className="shrink-0 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
                aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
                title={isDark ? 'Modo claro' : 'Modo escuro'}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            </div>
          </CardContent>
        </Card>


        {/* Notas pessoais (hoje e amanhã) */}
        {personalNotes.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-amber-500" />
                Minhas notas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {personalNotes.map((n) => (
                  <li
                    key={n.id}
                    className={`border rounded-lg p-3 flex items-start gap-2.5 shadow-sm ${
                      n.isToday
                        ? 'border-amber-500/40 bg-amber-50 dark:bg-amber-950/20'
                        : 'border-border bg-muted/30'
                    }`}
                  >
                    <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={n.isToday ? 'default' : 'secondary'} className="text-[10px] py-0 px-1.5">
                          {n.isToday ? 'Hoje' : 'Amanhã'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {formatDateBR(n.date)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{n.content}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}



        {/* Aniversariantes da semana */}
        {birthdays.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Cake className="w-5 h-5 text-primary" />
                Aniversariantes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {birthdays.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={b.photo_url || undefined} alt={b.name} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {getInitials(b.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{b.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{b.weekday}</p>
                    </div>
                    <span className="text-sm font-semibold text-primary tabular-nums">
                      {String(b.day).padStart(2, '0')}/{String(b.month).padStart(2, '0')}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Atividades operacionais — lista única ordenada por data */}
        {userActivities.length > 0 && (() => {
          const allTasks = userActivities.flatMap((u) =>
            [
              ...u.naoIniciado.map((a) => ({ ...a, status: 'naoIniciado' as const })),
              ...u.emAndamento.map((a) => ({ ...a, status: 'emAndamento' as const })),
            ]
          );
          allTasks.sort((a, b) => {
            // Atrasadas primeiro
            if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate.localeCompare(b.dueDate);
          });
          const totalNao = userActivities.reduce((s, u) => s + u.naoIniciado.length, 0);
          const totalAnd = userActivities.reduce((s, u) => s + u.emAndamento.length, 0);
          const totalOverdue = allTasks.filter((a) => a.isOverdue).length;
          return (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Atividades operacionais
                </CardTitle>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {totalOverdue > 0 && (
                    <Badge className="text-[10px] py-0 px-1.5 bg-destructive text-destructive-foreground hover:bg-destructive">
                      {totalOverdue} em atraso
                    </Badge>
                  )}
                  {totalNao > 0 && (
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                      {totalNao} não iniciado{totalNao > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {totalAnd > 0 && (
                    <Badge className="text-[10px] py-0 px-1.5 bg-info/15 text-info hover:bg-info/20">
                      {totalAnd} em andamento
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {allTasks.map((a) => {
                    const styleCls = a.isOverdue
                      ? 'border-destructive/50 bg-destructive/10 dark:bg-destructive/15 ring-1 ring-destructive/30'
                      : a.isToday
                        ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/25 ring-1 ring-amber-500/30'
                        : a.status === 'emAndamento'
                          ? 'border-info/25 bg-info/[0.08]'
                          : 'border-border bg-muted/30';
                    return (
                      <li
                        key={a.id}
                        className={`border rounded-lg p-3 flex items-start gap-2.5 shadow-sm ${styleCls}`}
                      >
                        <Checkbox
                          className="mt-0.5"
                          onCheckedChange={(c) => c && handleCompleteActivity(a.id)}
                          aria-label="Concluir tarefa"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`text-sm font-medium leading-snug break-words ${a.isOverdue ? 'text-destructive' : a.isToday ? 'text-amber-700 dark:text-amber-300' : ''}`}>{a.title}</p>
                            {a.isOverdue && (
                              <Badge className="text-[10px] py-0 px-1.5 gap-1 bg-destructive text-destructive-foreground hover:bg-destructive">
                                <AlertTriangle className="w-3 h-3" />
                                Em atraso
                              </Badge>
                            )}
                            {a.isToday && !a.isOverdue && (
                              <Badge className="text-[10px] py-0 px-1.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20">
                                Hoje
                              </Badge>
                            )}
                            {a.status === 'emAndamento' ? (
                              <Badge className="text-[10px] py-0 px-1.5 bg-info/15 text-info hover:bg-info/20">
                                Em andamento
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                                Não iniciado
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{a.projectName}</p>
                          {a.freelaName && (
                            <p className="text-xs text-amber-600 font-medium tabular-nums flex items-center gap-1">
                              <span className="inline-block w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold flex items-center justify-center">F</span>
                              {a.freelaName}
                            </p>
                          )}
                          {a.dueDate && (
                            <p className={`text-xs tabular-nums ${a.isOverdue ? 'text-destructive font-semibold' : a.isToday ? 'text-amber-700 dark:text-amber-300 font-semibold' : 'text-muted-foreground'}`}>
                              {a.isOverdue ? `Venceu em ${formatDateBR(a.dueDate)}` : a.isToday ? `Vence hoje, ${formatDateBR(a.dueDate)}` : formatDateBR(a.dueDate)}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 -mr-1 -mt-1 h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => openProject(a.projectCardId, a.projectName)}
                          title="Abrir projeto"
                          aria-label="Abrir projeto"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })()}

        {/* Menções em comentários */}
        {mentions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AtSign className="w-5 h-5 text-primary" />
                Você foi mencionado ({mentions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {mentions.map((m) => {
                  const initials = (m.authorName || '?').split(' ').filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase();
                  const when = m.createdAt
                    ? new Date(m.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : '';
                  return (
                    <li key={`${m.cardId}-${m.commentId}`} className="border border-primary/30 bg-primary/5 rounded-lg p-3 flex items-start gap-2.5 shadow-sm">
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarImage src={m.authorPhoto || undefined} alt={m.authorName} />
                        <AvatarFallback className="text-[10px] bg-muted">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">{m.authorName}</p>
                          <span className="text-[10px] text-muted-foreground">em {m.projectName}</span>
                          {when && <span className="text-[10px] text-muted-foreground ml-auto">{when}</span>}
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {m.text.split(/(@[\p{L}\d_]+)/u).map((part, i) =>
                            part.startsWith('@')
                              ? <span key={i} className="text-primary font-medium bg-primary/10 rounded px-1">{part}</span>
                              : <span key={i}>{part}</span>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openProject(m.cardId, m.projectName)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary transition"
                          title="Abrir projeto"
                          aria-label="Abrir projeto"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkMentionRead(m.cardId, m.commentId)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-border bg-background hover:bg-success hover:text-success-foreground hover:border-success transition"
                          title="Marcar como lido"
                          aria-label="Marcar como lido"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Próximas ações de leads (prospecção) */}
        {leadAlerts.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Leads — próxima ação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {leadAlerts.map((l) => {
                  const styles =
                    l.status === 'overdue'
                      ? 'border-destructive/30 bg-destructive/5'
                      : l.status === 'today'
                        ? 'border-amber-500/40 bg-amber-50 dark:bg-amber-950/20'
                        : 'border-border bg-muted/30';
                  const label = l.status === 'overdue' ? 'Em atraso' : l.status === 'today' ? 'Hoje' : 'Em breve';
                  const badgeVariant: 'destructive' | 'default' | 'secondary' =
                    l.status === 'overdue' ? 'destructive' : l.status === 'today' ? 'default' : 'secondary';
                  return (
                    <li
                      key={l.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/prospeccao?lead=${l.id}`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/prospeccao?lead=${l.id}`); } }}
                      className={`border ${styles} rounded-lg p-3 flex items-start gap-2.5 shadow-sm cursor-pointer hover:shadow-md hover:brightness-[1.02] transition`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold truncate">{l.companyName}</p>
                          <Badge variant={badgeVariant} className="text-[10px] py-0 px-1.5">
                            {label}
                          </Badge>
                        </div>
                        {l.nextAction && (
                          <p className="text-xs text-muted-foreground break-words">{l.nextAction}</p>
                        )}
                        <p className="text-xs font-medium tabular-nums">
                          Próxima ação em {formatDateBR(l.nextActionDate)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <ProjectActivitiesDialog
        open={!!activityDialog}
        onOpenChange={(o) => { if (!o) setActivityDialog(null); }}
        projectCardId={activityDialog?.projectCardId || ''}
        projectName={activityDialog?.projectName || ''}
      />
    </div>
  );
}
