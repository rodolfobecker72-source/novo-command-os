import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { Upload, Save, Trash2, ImageIcon, FileText } from 'lucide-react';

interface LayoutData {
  logoUrl: string;
  companyName: string;
  website: string;
  email: string;
  pdfTitle: string;
  sectionClientTitle: string;
  sectionBriefingTitle: string;
  sectionInclusionsTitle: string;
  sectionServicesTitle: string;
  sectionOperationalTitle: string;
  sectionInvestmentTitle: string;
  sectionTotalTitle: string;
  validityText: string;
  coverPdfUrl: string;
  backPdfUrl: string;
}

const DEFAULTS: LayoutData = {
  logoUrl: '',
  companyName: '',
  website: '',
  email: '',
  pdfTitle: 'PROPOSTA COMERCIAL',
  sectionClientTitle: 'CLIENTE',
  sectionBriefingTitle: 'BRIEFING DO PROJETO',
  sectionInclusionsTitle: 'O QUE ESTÁ INCLUSO',
  sectionServicesTitle: 'SERVIÇOS',
  sectionOperationalTitle: 'DESPESAS OPERACIONAIS',
  sectionInvestmentTitle: 'COMPOSIÇÃO DO INVESTIMENTO',
  sectionTotalTitle: 'INVESTIMENTO TOTAL',
  validityText: 'Validade: 30 dias',
  coverPdfUrl: '',
  backPdfUrl: '',
};

export function LayoutPage() {
  const { workspace } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<LayoutData>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace) return;
    loadLayout();
  }, [workspace]);

  useRealtimeSync({
    workspaceId: workspace?.id,
    tables: ['workspace_layout'],
    onChange: () => loadLayout(),
  });


  const loadLayout = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const { data: row, error } = await supabase
        .from('workspace_layout')
        .select('*')
        .eq('workspace_id', workspace.id)
        .maybeSingle();

      if (error) throw error;
      if (row) {
        const d = row as any;
        setExistingId(d.id);
        setData({
          logoUrl: d.logo_url || '',
          companyName: d.company_name || '',
          website: d.website || '',
          email: d.email || '',
          pdfTitle: d.pdf_title || DEFAULTS.pdfTitle,
          sectionClientTitle: d.section_client_title || DEFAULTS.sectionClientTitle,
          sectionBriefingTitle: d.section_briefing_title || DEFAULTS.sectionBriefingTitle,
          sectionInclusionsTitle: d.section_inclusions_title || DEFAULTS.sectionInclusionsTitle,
          sectionServicesTitle: d.section_services_title || DEFAULTS.sectionServicesTitle,
          sectionOperationalTitle: d.section_operational_title || DEFAULTS.sectionOperationalTitle,
          sectionInvestmentTitle: d.section_investment_title || DEFAULTS.sectionInvestmentTitle,
          sectionTotalTitle: d.section_total_title || DEFAULTS.sectionTotalTitle,
          validityText: d.validity_text || DEFAULTS.validityText,
          coverPdfUrl: d.cover_pdf_url || '',
          backPdfUrl: d.back_pdf_url || '',
        });
      }
    } catch (err) {
      console.error('Error loading layout:', err);
    } finally {
      setLoading(false);
    }
  };

  const update = (field: keyof LayoutData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspace) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `${workspace.id}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(filePath);
      update('logoUrl', `${publicUrlData.publicUrl}?t=${Date.now()}`);
      toast.success('Logo enviada com sucesso!');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Erro ao enviar logo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const [pdfUploading, setPdfUploading] = useState<'cover' | 'back' | null>(null);
  const handleCustomPdfUpload = async (kind: 'cover' | 'back', file?: File) => {
    if (!file || !workspace) return;
    if (file.type !== 'application/pdf') { toast.error('Selecione um arquivo PDF'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('O PDF deve ter no máximo 10 MB'); return; }
    setPdfUploading(kind);
    try {
      const filePath = `${workspace.id}/${kind}.pdf`;
      const { error } = await supabase.storage.from('logos').upload(filePath, file, { upsert: true, contentType: 'application/pdf' });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('logos').getPublicUrl(filePath);
      update(kind === 'cover' ? 'coverPdfUrl' : 'backPdfUrl', `${pub.publicUrl}?t=${Date.now()}`);
      toast.success('PDF enviado! Clique em Salvar para aplicar.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar PDF');
    } finally {
      setPdfUploading(null);
    }
  };

  const handleSave = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      const payload = {
        workspace_id: workspace.id,
        logo_url: data.logoUrl,
        cover_pdf_url: data.coverPdfUrl || null,
        back_pdf_url: data.backPdfUrl || null,
        company_name: data.companyName,
        website: data.website,
        email: data.email,
        pdf_title: data.pdfTitle,
        section_client_title: data.sectionClientTitle,
        section_briefing_title: data.sectionBriefingTitle,
        section_inclusions_title: data.sectionInclusionsTitle,
        section_services_title: data.sectionServicesTitle,
        section_operational_title: data.sectionOperationalTitle,
        section_investment_title: data.sectionInvestmentTitle,
        section_total_title: data.sectionTotalTitle,
        validity_text: data.validityText,
      };

      if (existingId) {
        const { error } = await supabase.from('workspace_layout').update(payload).eq('id', existingId);
        if (error) throw error;
      } else {
        const { data: newRow, error } = await supabase.from('workspace_layout').insert(payload).select('id').single();
        if (error) throw error;
        setExistingId(newRow.id);
      }
      toast.success('Layout salvo com sucesso!');
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Erro ao salvar layout');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1">
        <Header title="Layout da Proposta" subtitle="Configurações de identidade visual para documentos" />
        <div className="p-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <Header title="Layout da Proposta" subtitle="Configurações de identidade visual para documentos" />

      <div className="p-4 md:p-6 max-w-2xl space-y-4 md:space-y-6">
        {/* Logo Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Páginas personalizadas</CardTitle>
            <CardDescription>Envie um PDF para ser a primeira página (capa) e outro para a última página. As páginas da proposta ficam no meio.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {([['cover', 'Primeira página (capa)', 'coverPdfUrl'], ['back', 'Última página', 'backPdfUrl']] as const).map(([kind, label, field]) => (
              <div key={kind} className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-md border p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    {data[field] ? (
                      <a href={data[field]} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Ver PDF enviado</a>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhum arquivo</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <label>
                    <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { handleCustomPdfUpload(kind, e.target.files?.[0]); e.target.value = ''; }} />
                    <Button variant="outline" size="sm" asChild disabled={pdfUploading === kind}>
                      <span className="cursor-pointer"><Upload className="w-4 h-4 mr-2" />{pdfUploading === kind ? 'Enviando...' : data[field] ? 'Trocar' : 'Enviar PDF'}</span>
                    </Button>
                  </label>
                  {data[field] && (
                    <Button variant="ghost" size="sm" onClick={() => update(field, '')} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cabeçalho do Documento</CardTitle>
            <CardDescription>Logo e título exibidos no topo de cada página do PDF.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-6">
              <div
                className="w-28 h-28 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-muted/30 cursor-pointer hover:border-primary/50 transition-colors shrink-0"
                onClick={() => fileInputRef.current?.click()}
              >
                {data.logoUrl ? (
                  <img src={data.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-xs">1:1</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="w-4 h-4 mr-1.5" />
                  {uploading ? 'Enviando...' : 'Enviar logo'}
                </Button>
                {data.logoUrl && (
                  <Button variant="ghost" size="sm" onClick={() => update('logoUrl', '')} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Remover
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">PNG ou JPG. Proporção 1:1 recomendada.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Título do Documento</Label>
              <Input value={data.pdfTitle} onChange={e => update('pdfTitle', e.target.value)} placeholder="PROPOSTA COMERCIAL" />
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informações do Rodapé</CardTitle>
            <CardDescription>Dados exibidos no rodapé de todos os PDFs gerados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Produtora</Label>
              <Input value={data.companyName} onChange={e => update('companyName', e.target.value)} placeholder="Ex: Minha Produtora Audiovisual" />
            </div>
            <div className="space-y-2">
              <Label>Site</Label>
              <Input value={data.website} onChange={e => update('website', e.target.value)} placeholder="Ex: www.minhaprodutora.com.br" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={data.email} onChange={e => update('email', e.target.value)} placeholder="Ex: contato@minhaprodutora.com.br" />
            </div>
          </CardContent>
        </Card>

        {/* Section Titles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Títulos das Seções</CardTitle>
            <CardDescription>Personalize os títulos de cada bloco do documento PDF.</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="titles">
                <AccordionTrigger className="text-sm">Editar títulos das seções</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  {([
                    ['sectionClientTitle', 'Seção: Cliente'],
                    ['sectionBriefingTitle', 'Seção: Briefing'],
                    
                    ['sectionServicesTitle', 'Seção: Serviços'],
                    ['sectionOperationalTitle', 'Seção: Despesas Operacionais'],
                    ['sectionInvestmentTitle', 'Seção: Composição do Investimento'],
                    ['sectionTotalTitle', 'Seção: Investimento Total'],
                  ] as [keyof LayoutData, string][]).map(([field, label]) => (
                    <div key={field} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      <Input value={data[field]} onChange={e => update(field, e.target.value)} />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Texto de Validade</Label>
                    <Input value={data.validityText} onChange={e => update('validityText', e.target.value)} placeholder="Validade: 30 dias" />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>


        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Salvando...' : 'Salvar Layout'}
          </Button>
        </div>
      </div>
    </div>
  );
}
