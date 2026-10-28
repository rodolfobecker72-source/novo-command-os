import { supabase } from '@/integrations/supabase/client';
import type { PDFLayoutSettings } from '@/utils/pdfGenerator';

/** Workspace "Layout da Proposta" settings in the shape the PDF generators expect. */
export async function fetchLayoutSettings(workspaceId: string | undefined | null): Promise<PDFLayoutSettings | null> {
  if (!workspaceId) return null;
  try {
    const { data } = await supabase
      .from('workspace_layout')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (!data) return null;
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
      coverPdfUrl: d.cover_pdf_url || undefined,
      backPdfUrl: d.back_pdf_url || undefined,
      brandTheme: d.brand_theme || null,
      companyCnpj: d.company_cnpj || '',
      companyAddress: d.company_address || '',
      companyCityLine: d.company_city_line || '',
    };
  } catch (err) {
    console.warn('Could not load layout settings:', err);
    return null;
  }
}
