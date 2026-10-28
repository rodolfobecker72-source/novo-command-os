import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/layout/Header';
import { useAuth, type AppRole, type Profile } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pencil, Trash2, UserPlus, Crown, ShieldCheck, Briefcase, Camera, Users, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface MemberWithProfile {
  id: string;
  user_id: string;
  role: AppRole;
  joined_at: string;
  email: string;
  profile: Profile | null;
}

const ROLE_LABELS: Record<AppRole, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  vendedor: 'Vendedor',
  time_hero: 'Time Operacional',
};

const ROLE_ICONS: Record<AppRole, typeof Crown> = {
  owner: Crown,
  admin: ShieldCheck,
  vendedor: Briefcase,
  time_hero: Users,
};

const ROLE_COLORS: Record<AppRole, string> = {
  owner: 'bg-primary/10 text-primary',
  admin: 'bg-accent/10 text-accent',
  vendedor: 'bg-warning/10 text-warning',
  time_hero: 'bg-blue-500/10 text-blue-600',
};

export function UsersPage() {
  const { workspace, role: currentRole } = useAuth();
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberWithProfile | null>(null);
  const [deletingMember, setDeletingMember] = useState<MemberWithProfile | null>(null);
  const [resetPasswordMember, setResetPasswordMember] = useState<MemberWithProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'vendedor' as AppRole,
    birthDate: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    role: 'vendedor' as AppRole,
    birthDate: '',
  });

  const canManage = currentRole === 'owner';

  const isCreateFormValid =
    createForm.name.trim().length > 0 &&
    createForm.email.trim().length > 0 &&
    createForm.password.length >= 6;

  const loadMembers = async () => {
    if (!workspace) return;
    setIsLoading(true);

    try {
      const response = await supabase.functions.invoke('list-workspace-members');
      if (response.error) {
        toast.error('Erro ao carregar membros: ' + (response.error.message || 'Erro desconhecido'));
        setIsLoading(false);
        return;
      }

      const result = response.data;
      if (result?.error) {
        toast.error('Erro ao carregar membros: ' + result.error);
        setIsLoading(false);
        return;
      }

      const membersWithProfiles: MemberWithProfile[] = (result?.members || []).map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role as AppRole,
        joined_at: m.joined_at,
        email: m.email || '',
        profile: m.profile as Profile | null,
      }));

      setMembers(membersWithProfiles);
    } catch (err: any) {
      toast.error('Erro ao carregar membros: ' + err.message);
    }

    setIsLoading(false);
  };

  const workspaceId = workspace?.id;

  useEffect(() => {
    loadMembers();
  }, [workspaceId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCreateFormValid) return;

    setIsCreating(true);

    try {
      const response = await supabase.functions.invoke('create-member', {
        body: {
          email: createForm.email.trim(),
          password: createForm.password,
          name: createForm.name.trim(),
          role: createForm.role,
          birthDate: createForm.birthDate || null,
        },
      });

      if (response.error) {
        toast.error('Erro ao criar membro: ' + (response.error.message || 'Erro desconhecido'));
        setIsCreating(false);
        return;
      }

      const result = response.data;
      if (result?.error) {
        toast.error('Erro ao criar membro: ' + result.error);
        setIsCreating(false);
        return;
      }

      toast.success(`Membro ${createForm.name.trim()} criado com sucesso!`);
      setIsCreateOpen(false);
      setCreateForm({ name: '', email: '', password: '', role: 'vendedor', birthDate: '' });
      loadMembers();
    } catch (err: any) {
      toast.error('Erro ao criar membro: ' + err.message);
    }
    setIsCreating(false);
  };

  const handleEditMember = (member: MemberWithProfile) => {
    setEditingMember(member);
    setEditForm({
      name: member.profile?.name || '',
      role: member.role,
      birthDate: member.profile?.birth_date || '',
    });
    setAvatarFile(null);
    setAvatarPreview(member.profile?.photo_url || null);
    setIsEditOpen(true);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem válido.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB.');
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = async () => {
    if (!editingMember) return;
    setIsSavingEdit(true);

    try {
      let photoUrl: string | undefined = undefined;

      // Upload avatar if changed
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop() || 'png';
        const filePath = `${editingMember.user_id}/avatar.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) {
          toast.error('Erro ao fazer upload da foto: ' + uploadError.message);
          setIsSavingEdit(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        photoUrl = publicUrlData.publicUrl + '?t=' + Date.now();
      }

      // Call edge function to update profile + role
      const response = await supabase.functions.invoke('update-member-profile', {
        body: {
          targetUserId: editingMember.user_id,
          name: editForm.name.trim(),
          photoUrl,
          role: editForm.role,
          birthDate: editForm.birthDate || null,
        },
      });

      if (response.error) {
        toast.error('Erro ao atualizar: ' + (response.error.message || 'Erro desconhecido'));
        setIsSavingEdit(false);
        return;
      }

      const result = response.data;
      if (result?.error) {
        toast.error('Erro ao atualizar: ' + result.error);
        setIsSavingEdit(false);
        return;
      }

      toast.success('Membro atualizado com sucesso!');
      setIsEditOpen(false);
      setEditingMember(null);
      setAvatarFile(null);
      setAvatarPreview(null);
      loadMembers();
    } catch (err: any) {
      toast.error('Erro ao atualizar: ' + err.message);
    }
    setIsSavingEdit(false);
  };

  const handleConfirmRemove = async () => {
    if (!deletingMember) return;

    try {
      const response = await supabase.functions.invoke('delete-member', {
        body: { targetUserId: deletingMember.user_id },
      });

      if (response.error) {
        toast.error('Erro ao remover: ' + (response.error.message || 'Erro desconhecido'));
        setDeletingMember(null);
        return;
      }

      const result = response.data;
      if (result?.error) {
        toast.error('Erro ao remover: ' + result.error);
        setDeletingMember(null);
        return;
      }

      toast.success('Membro removido!');
      loadMembers();
    } catch (err: any) {
      toast.error('Erro ao remover: ' + err.message);
    }
    setDeletingMember(null);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordMember) return;
    if (newPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsResettingPassword(true);
    try {
      const response = await supabase.functions.invoke('reset-user-password', {
        body: { targetUserId: resetPasswordMember.user_id, new_password: newPassword },
      });

      if (response.error) {
        toast.error('Erro ao redefinir senha: ' + (response.error.message || 'Erro desconhecido'));
        return;
      }

      const result = response.data;
      if (result?.error) {
        toast.error('Erro ao redefinir senha: ' + result.error);
        return;
      }

      toast.success(`Senha redefinida para ${resetPasswordMember.email}`);
      setResetPasswordMember(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error('Erro ao redefinir senha: ' + err.message);
    } finally {
      setIsResettingPassword(false);
    }
  };


  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (currentRole !== 'owner') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Apenas o proprietário pode acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title="Equipe" subtitle={workspace ? `Membros de ${workspace.name}` : 'Gerenciamento de equipe'} />

      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Membros ({members.length})</CardTitle>
            {canManage && (
              <Dialog open={isCreateOpen} onOpenChange={(open) => {
                setIsCreateOpen(open);
                if (!open) setCreateForm({ name: '', email: '', password: '', role: 'vendedor', birthDate: '' });
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Novo Membro
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Cadastrar Membro</DialogTitle>
                    <DialogDescription>
                      Crie uma conta para um novo membro da equipe.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="create-name">Nome <span className="text-destructive">*</span></Label>
                      <Input
                        id="create-name"
                        type="text"
                        placeholder="Nome completo"
                        value={createForm.name}
                        onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-email">Email <span className="text-destructive">*</span></Label>
                      <Input
                        id="create-email"
                        type="email"
                        placeholder="email@exemplo.com"
                        value={createForm.email}
                        onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-password">Senha <span className="text-destructive">*</span></Label>
                      <PasswordInput
                        id="create-password"
                        placeholder="Mínimo 6 caracteres"
                        value={createForm.password}
                        onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                        required
                        minLength={6}
                      />
                      {createForm.password.length > 0 && createForm.password.length < 6 && (
                        <p className="text-xs text-destructive">A senha deve ter no mínimo 6 caracteres</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-birth">Data de nascimento</Label>
                      <Input
                        id="create-birth"
                        type="date"
                        value={createForm.birthDate}
                        onChange={e => setCreateForm({ ...createForm, birthDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Papel</Label>
                      <Select
                        value={createForm.role}
                        onValueChange={(v: AppRole) => setCreateForm({ ...createForm, role: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="vendedor">Vendedor</SelectItem>
                          <SelectItem value="time_hero">Time Operacional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={isCreating || !isCreateFormValid}>
                        {isCreating ? 'Criando...' : 'Criar Membro'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Membro</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Papel</TableHead>
                        {canManage && <TableHead className="text-right">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map(member => {
                        const RoleIcon = ROLE_ICONS[member.role] ?? Users;
                        return (
                          <TableRow key={member.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarImage src={member.profile?.photo_url || undefined} />
                                  <AvatarFallback>
                                    {member.profile ? getInitials(member.profile.name) : '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{member.profile?.name || 'Sem nome'}</p>
                                  {member.profile?.birth_date && (
                                    <p className="text-xs text-muted-foreground">
                                      Nasc.: {new Date(member.profile.birth_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm text-muted-foreground">{member.email || '—'}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={ROLE_COLORS[member.role]}>
                                <RoleIcon className="w-3 h-3 mr-1" />
                                {ROLE_LABELS[member.role]}
                              </Badge>
                            </TableCell>
                            {canManage && (
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="icon" onClick={() => handleEditMember(member)} title="Editar">
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setResetPasswordMember(member)}
                                    title="Redefinir senha"
                                  >
                                    <KeyRound className="w-4 h-4" />
                                  </Button>
                                  {member.role !== 'owner' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => setDeletingMember(member)}
                                      title="Remover"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile card list */}
                <div className="md:hidden space-y-3">
                  {members.map(member => {
                    const RoleIcon = ROLE_ICONS[member.role] ?? Users;
                    return (
                      <div key={member.id} className="border border-border/60 rounded-lg p-3 space-y-2.5">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={member.profile?.photo_url || undefined} />
                            <AvatarFallback>
                              {member.profile ? getInitials(member.profile.name) : '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{member.profile?.name || 'Sem nome'}</p>
                            <p className="text-xs text-muted-foreground truncate">{member.email || '—'}</p>
                          </div>
                          {canManage && (
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditMember(member)} title="Editar">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setResetPasswordMember(member)}
                                title="Redefinir senha"
                              >
                                <KeyRound className="w-4 h-4" />
                              </Button>
                              {member.role !== 'owner' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeletingMember(member)}
                                  title="Remover"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <Badge variant="secondary" className={ROLE_COLORS[member.role]}>
                            <RoleIcon className="w-3 h-3 mr-1" />
                            {ROLE_LABELS[member.role]}
                          </Badge>
                          {member.profile?.birth_date && (
                            <span className="text-xs text-muted-foreground">
                              Nasc.: {new Date(member.profile.birth_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Edit Member Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setAvatarFile(null);
            setAvatarPreview(null);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Membro</DialogTitle>
              <DialogDescription>
                Altere as informações de {editingMember?.profile?.name || 'membro'}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-3">
                <div
                  className="relative group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={avatarPreview || undefined} />
                    <AvatarFallback className="text-lg">
                      {editingMember?.profile ? getInitials(editingMember.profile.name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Alterar foto
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  type="text"
                  placeholder="Nome do membro"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              {/* Birth date */}
              <div className="space-y-2">
                <Label htmlFor="edit-birth">Data de nascimento</Label>
                <Input
                  id="edit-birth"
                  type="date"
                  value={editForm.birthDate}
                  onChange={e => setEditForm({ ...editForm, birthDate: e.target.value })}
                />
              </div>

              {/* Role - hidden when editing owner */}
              {editingMember?.role !== 'owner' && (
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select
                    value={editForm.role}
                    onValueChange={(v: AppRole) => setEditForm({ ...editForm, role: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="vendedor">Vendedor</SelectItem>
                      <SelectItem value="time_hero">Time Operacional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSavingEdit}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveEdit} disabled={isSavingEdit || editForm.name.trim().length === 0}>
                  {isSavingEdit ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog
          open={!!resetPasswordMember}
          onOpenChange={(open) => {
            if (!open) {
              setResetPasswordMember(null);
              setNewPassword('');
              setConfirmPassword('');
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Redefinir senha</DialogTitle>
              <DialogDescription>
                Definir uma nova senha para{' '}
                <strong>{resetPasswordMember?.profile?.name || resetPasswordMember?.email}</strong>
                {resetPasswordMember?.profile?.name && (
                  <span className="block text-xs text-muted-foreground mt-1">
                    {resetPasswordMember.email}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-new-password">Nova senha <span className="text-destructive">*</span></Label>
                <PasswordInput
                  id="reset-new-password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                {newPassword.length > 0 && newPassword.length < 6 && (
                  <p className="text-xs text-destructive">A senha deve ter no mínimo 6 caracteres</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-confirm-password">Confirmar nova senha <span className="text-destructive">*</span></Label>
                <PasswordInput
                  id="reset-confirm-password"
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">As senhas não coincidem</p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setResetPasswordMember(null)}
                  disabled={isResettingPassword}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleResetPassword}
                  disabled={
                    isResettingPassword ||
                    newPassword.length < 6 ||
                    newPassword !== confirmPassword
                  }
                >
                  {isResettingPassword ? 'Salvando...' : 'Salvar nova senha'}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingMember} onOpenChange={(open) => { if (!open) setDeletingMember(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover membro</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover <strong>{deletingMember?.profile?.name || 'este membro'}</strong> da equipe? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
