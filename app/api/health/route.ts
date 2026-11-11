import { NextResponse } from 'next/server';

/**
 * Verificação de saúde, para monitoramento externo.
 *
 * Hoje não há nada que avise se o app cair: você só descobre quando um
 * usuário reclama. Com este endpoint, um serviço gratuito de uptime
 * (UptimeRobot, Better Stack, cron-job.org) consegue checar a cada 5 minutos
 * e te avisar por e-mail.
 *
 * Responde 503 quando a configuração essencial falta — assim o monitor acusa
 * um deploy mal configurado, não só o servidor fora do ar. Foi exatamente o
 * que aconteceu quando as variáveis do Supabase não estavam na Vercel.
 *
 * NÃO expõe nada sensível: só diz se a variável existe, nunca o valor.
 */
export async function GET() {
  const checks = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };

  const healthy = checks.supabaseUrl && checks.supabaseKey;

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      checks,
      // Qual codigo esta realmente servindo este endereco.
      //
      // Sem isto, "o deploy saiu?" so se responde cacando uma string dentro
      // dos pacotes JavaScript minificados — foi o que precisei fazer hoje
      // para descobrir que dois enderecos serviam o mesmo commit.
      //
      // A Vercel preenche estas variaveis sozinha. Local, viram null.
      versao: {
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        ambiente: process.env.VERCEL_ENV ?? 'local',
      },
      // Recursos de IA ausentes não derrubam o app: é informação, não falha.
      ai: Boolean(process.env.GEMINI_API_KEY),
      at: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
