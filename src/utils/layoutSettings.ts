import { supabase } from '@/integrations/supabase/client';
import type { PDFLayoutSettings } from '@/utils/pdfGenerator';
import { normalizeNextSteps } from '@/utils/proposalStyle';

/** Workspace "Layout da Proposta" settings in the shape the PDF generators expect. */
export async function fetchLayoutSettings(workspaceId: string | undefined | null): Promise<PDFLayoutSettings | null> {
  if (!workspaceId) return null;
  try {
    const [{ data }, { data: settings }] = await Promise.all([
      supabase.from('workspace_layout').select('*').eq('workspace_id', workspaceId).maybeSingle(),
      supabase.from('workspace_settings').select('proposal_validity_days').eq('workspace_id', workspaceId).maybeSingle(),
    ]);
    const validityDays = settings?.proposal_validity_days ?? undefined;
    if (!data) return validityDays ? ({ logoUrl: '', companyName: '', website: '', email: '', validityDays } as PDFLayoutSettings) : null;
    const d = data as any;
    return {
      logoUrl: d.logo_url || '',
      companyName: d.company_name || '',
      website: d.website || '',
      email: d.email || '',
      pdfTitle: d.pdf_title || undefined,
      sectionClientTitle: d.section_client_title || undefined,
      sectionBriefingTitle: d.section_briefing_title || undefined,
      sectionInclusionsTitle: d.section_inclusions_title || undefined,
      sectionServicesTitle: d.section_services_title || undefined,
      sectionOperationalTitle: d.section_operational_title || undefined,
      sectionInvestmentTitle: d.section_investment_title || undefined,
      sectionTotalTitle: d.section_total_title || undefined,
      validityText: d.validity_text || undefined,
      validityDays,
      coverPdfUrl: d.cover_pdf_url || undefined,
      backPdfUrl: d.back_pdf_url || undefined,
      brandTheme: d.brand_theme || null,
      companyCnpj: d.company_cnpj || '',
      companyAddress: d.company_address || '',
      companyCityLine: d.company_city_line || '',
      proposalStyle: d.proposal_style === 'moderno' ? 'moderno' : 'classico',
      coverStyle: d.cover_style || 'cor',
      coverImageUrl: d.cover_image_url || undefined,
      cornerStyle: d.corner_style || 'arredondado',
      nextSteps: d.next_steps ? normalizeNextSteps(d.next_steps) : null,
      whatsapp: d.whatsapp || '',
    };
  } catch (err) {
    console.warn('Could not load layout settings:', err);
    return null;
  }
}
