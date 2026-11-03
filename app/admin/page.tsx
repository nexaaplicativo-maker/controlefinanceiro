"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Shield, Users, TrendingUp, TrendingDown, DollarSign,
  ChevronLeft, RefreshCw, Search, CheckCircle2, XCircle, Loader2, MessageSquare
} from "lucide-react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { toast } from "../../components/Toast";
import { ToastContainer } from "../../components/Toast";
import { FeedbackInboxModal } from "../../components/FeedbackInboxModal";
import { formatMoney } from "../../lib/format";

/** Espelha o retorno de public.admin_user_stats() */
interface UserStat {
  id: string;
  email: string;
  role: string;
  created_at: string;
  transaction_count: number;
  total_income: number;
  total_expense: number;
  /** Data da última transação; null para quem nunca lançou nada */
  last_activity: string | null;
}

export default function AdminPage() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<UserStat[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalTransactions: 0, totalVolume: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [novosFeedbacks, setNovosFeedbacks] = useState(0);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/login'; return; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      window.location.href = '/';
      return;
    }

    setIsAuthorized(true);
    await loadData();
  }

  async function loadData() {
    setIsRefreshing(true);
    try {
      // Agregação no banco, não no navegador.
      //
      // Antes esta função baixava TODAS as transações de TODOS os usuários e
      // somava num forEach aqui. Com algumas dezenas de contas ativas isso
      // trava o browser e trafega dados que não precisavam sair do Postgres.
      //
      // E o e-mail era inventado a partir do id (`user-a3f9c2d1`), com um
      // comentário assumindo que ler o real exigiria service role. Não exige:
      // a função SECURITY DEFINER lê auth.users e verifica ela mesma quem está
      // chamando.
      const [statsRes, totalsRes] = await Promise.all([
        supabase.rpc('admin_user_stats'),
        supabase.rpc('admin_platform_totals'),
      ]);

      if (statsRes.error) {
        // Mensagem específica quando o SQL ainda não foi aplicado, para não
        // parecer falha de permissão.
        const faltaFuncao = statsRes.error.message?.includes('admin_user_stats');
        toast(
          faltaFuncao
            ? "Rode o SQL 2026-10-01-admin-stats.sql no painel do Supabase."
            : "Erro ao carregar dados do admin: " + statsRes.error.message,
          "error",
        );
        return;
      }

      // Contador de nao lidos no cabecalho: sem badge, a caixa de entrada
      // so e aberta por quem lembra que ela existe.
      const { count } = await supabase
        .from('feedback').select('id', { count: 'exact', head: true }).eq('status', 'novo');
      setNovosFeedbacks(count ?? 0);

      setUsers((statsRes.data as UserStat[]) ?? []);

      const totals = totalsRes.data?.[0];
      if (totals) {
        setStats({
          totalUsers: Number(totals.total_users) || 0,
          totalTransactions: Number(totals.total_transactions) || 0,
          totalVolume: Number(totals.total_volume) || 0,
        });
      }
    } catch (err) {
      toast("Erro ao carregar dados do admin.", "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  async function handleToggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === 'admin' ? 'client' : 'admin';
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast(`Usuário ${newRole === 'admin' ? 'promovido a Admin' : 'rebaixado para Cliente'}.`, "success");
    } else {
      toast("Erro ao alterar role.", "error");
    }
  }


  const filteredUsers = users.filter(u =>
    u.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-canvas flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="min-h-[100dvh] bg-canvas text-ink font-sans">
      <FeedbackInboxModal isOpen={isInboxOpen} onClose={() => { setIsInboxOpen(false); loadData(); }} />
      <ToastContainer />

      {/* Navbar */}
      <nav className="border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-ink-2 hover:text-ink">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-field bg-brand/20 border border-brand/30 flex items-center justify-center">
                <Shield className="w-4 h-4 text-brand" />
              </div>
              <span className="font-bold text-lg tracking-tight">Painel Admin</span>
              <span className="text-xs bg-brand/20 text-brand border border-brand/30 px-2 py-0.5 rounded-full font-medium">NEXA</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsInboxOpen(true)}
              className="flex items-center gap-2 text-sm text-brand hover:text-brand bg-brand/10 hover:bg-brand/20 border border-brand/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer relative"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Feedback</span>
              {novosFeedbacks > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-neg text-ink text-xs font-bold rounded-full flex items-center justify-center">
                  {novosFeedbacks}
                </span>
              )}
            </button>

            <button
              onClick={loadData}
              disabled={isRefreshing}
              className="flex items-center gap-2 text-sm text-ink-2 hover:text-ink bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">Visão Geral do Sistema</h1>
          <p className="text-ink-2">Gerencie usuários, permissões e monitore a plataforma.</p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          {[
            { title: "Usuários Totais", value: stats.totalUsers, icon: <Users className="w-6 h-6 text-brand" />, color: "indigo" },
            { title: "Transações na Plataforma", value: stats.totalTransactions, icon: <TrendingUp className="w-6 h-6 text-pos" />, color: "emerald" },
            { title: "Volume Financeiro Total", value: formatMoney(stats.totalVolume), icon: <DollarSign className="w-6 h-6 text-warn" />, color: "amber" },
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white/5 border border-white/10 rounded-card p-6 backdrop-blur-sm relative overflow-hidden"
            >
              <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-20 bg-${card.color}-500`} />
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className={`p-3 rounded-inner bg-${card.color}-500/10 border border-${card.color}-500/20`}>
                  {card.icon}
                </div>
              </div>
              <p className="text-ink-2 text-sm font-medium mb-1 relative z-10">{card.title}</p>
              <p className="text-3xl font-semibold text-ink tracking-tight relative z-10">{card.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Users Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-semibold">Usuários Cadastrados</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3" />
              <input
                type="text"
                placeholder="Filtrar usuários..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-field py-2 pl-9 pr-4 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-brand transition-colors"
              />
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left text-xs font-semibold text-ink-2 px-6 py-4">Usuário</th>
                    <th className="text-left text-xs font-semibold text-ink-2 px-6 py-4">Role</th>
                    <th className="text-right text-xs font-semibold text-ink-2 px-6 py-4">Transações</th>
                    <th className="text-right text-xs font-semibold text-ink-2 px-6 py-4">Receitas</th>
                    <th className="text-right text-xs font-semibold text-ink-2 px-6 py-4">Despesas</th>
                    <th className="text-center text-xs font-semibold text-ink-2 px-6 py-4">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.map((user, i) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4">
                        {/* O e-mail vem de admin_user_stats(). Antes esta celula
                            mostrava o UUID, que nao identifica ninguem. O id fica
                            abaixo, pequeno, para quando for preciso casar com o
                            banco. */}
                        <p className="text-ink text-sm font-medium selectable">
                          {user.email || <span className="text-ink-3 italic">sem e-mail</span>}
                        </p>
                        <p className="text-ink-3 font-mono text-xs mt-0.5 selectable">{user.id}</p>
                        {user.last_activity && (
                          <p className="text-ink-3 text-xs mt-0.5">
                            último lançamento em {new Date(user.last_activity + "T12:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${user.role === 'admin' ? 'bg-brand/20 text-brand' : 'bg-pos/10 text-pos'}`}>
                          {user.role === 'admin' ? '👑 Admin' : '👤 Cliente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-ink font-medium">{user.transaction_count}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-pos font-medium">{formatMoney(user.total_income)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-neg font-medium">{formatMoney(user.total_expense)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggleRole(user.id, user.role)}
                          title={user.role === 'admin' ? 'Rebaixar para Cliente' : 'Promover para Admin'}
                          className={`p-2 rounded-lg transition-colors ${user.role === 'admin' ? 'text-brand hover:bg-brand/10' : 'text-ink-2 hover:text-brand hover:bg-brand/10'}`}
                        >
                          {user.role === 'admin' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="text-center py-12 text-ink-3">Nenhum usuário encontrado.</div>
              )}
            </div>
          </div>

          <p className="text-xs text-ink-3 mt-3 text-center">
            Nota: E-mails dos usuários não estão disponíveis via anon key. Use o Supabase Dashboard para ver e-mails completos.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
