import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, InsertTables, StyleDnaJobStatus } from '@/lib/supabase/types';

export class StyleDnaRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async createJob(input: { id: string; userId: string; name: string; now: string }) {
    const { data, error } = await this.supabase
      .from('style_dna_jobs')
      .insert({
        id: input.id,
        user_id: input.userId,
        name: input.name,
        status: 'pending',
        created_at: input.now,
        updated_at: input.now,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateJobStatus(id: string, userId: string, status: StyleDnaJobStatus, errorMessage?: string) {
    const { error } = await this.supabase
      .from('style_dna_jobs')
      .update({
        status,
        error_message: errorMessage || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
  }

  async createSourceTrack(row: InsertTables<'style_dna_source_tracks'>) {
    const { data, error } = await this.supabase.from('style_dna_source_tracks').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async createTrackAnalysis(row: InsertTables<'track_analyses'>) {
    const { data, error } = await this.supabase.from('track_analyses').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async createStyleDna(row: InsertTables<'style_dnas'>) {
    const { data, error } = await this.supabase.from('style_dnas').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async createPromptPackage(row: InsertTables<'suno_prompt_packages'>) {
    const { data, error } = await this.supabase.from('suno_prompt_packages').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async createFeedback(row: InsertTables<'generation_feedback'>) {
    const { data, error } = await this.supabase.from('generation_feedback').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async createTemplate(row: InsertTables<'style_dna_templates'>) {
    const { data, error } = await this.supabase.from('style_dna_templates').insert(row).select().single();
    if (error) throw error;
    return data;
  }

  async listTemplates(userId: string) {
    const { data, error } = await this.supabase
      .from('style_dna_templates')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return data || [];
  }

  async getJobBundle(jobId: string, userId: string) {
    const [job, tracks, analyses, dnas, packages, feedback] = await Promise.all([
      this.supabase.from('style_dna_jobs').select('*').eq('id', jobId).eq('user_id', userId).maybeSingle(),
      this.supabase.from('style_dna_source_tracks').select('*').eq('job_id', jobId).eq('user_id', userId),
      this.supabase.from('track_analyses').select('*').eq('job_id', jobId).eq('user_id', userId),
      this.supabase.from('style_dnas').select('*').eq('job_id', jobId).eq('user_id', userId).order('version', { ascending: false }),
      this.supabase.from('suno_prompt_packages').select('*').eq('job_id', jobId).eq('user_id', userId).order('prompt_version', { ascending: false }),
      this.supabase.from('generation_feedback').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ]);
    if (job.error) throw job.error;
    if (tracks.error) throw tracks.error;
    if (analyses.error) throw analyses.error;
    if (dnas.error) throw dnas.error;
    if (packages.error) throw packages.error;
    if (feedback.error) throw feedback.error;
    return {
      job: job.data,
      tracks: tracks.data || [],
      analyses: analyses.data || [],
      styleDnas: dnas.data || [],
      promptPackages: packages.data || [],
      feedback: feedback.data || [],
    };
  }
}
