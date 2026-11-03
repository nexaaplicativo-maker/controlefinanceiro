"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Heart, Home, Plane, Target, Plus, ChevronLeft, Building, PiggyBank, Sparkles, Settings } from "lucide-react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { CoupleGoalModal } from "../../components/CoupleGoalModal";
import { CoupleWealthModal } from "../../components/CoupleWealthModal";
import { formatMoney } from "../../lib/format";

export default function CasaisDashboard() {
  const [settings, setSettings] = useState<any>(null);
  const [goals, setGoals] = useState<any[]>([]);
  
  const [isWealthModalOpen, setIsWealthModalOpen] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/login';
      return;
    }

    // Busca os dados do Cofre
    const { data: sData } = await supabase.from('couple_settings').select('*').eq('user_id', session.user.id).single();
    if (sData) setSettings(sData);

    // Busca as Metas e ordena pelas mais antigas
    const { data: gData } = await supabase.from('couple_goals').select('*').eq('user_id', session.user.id).order('created_at', { ascending: true });
    if (gData) setGoals(gData);
  };

  useEffect(() => {
    fetchData();
  }, []);


  const openNewGoal = () => {
    setSelectedGoal(null);
    setIsGoalModalOpen(true);
  };

  const openAddFunds = (goal: any) => {
    setSelectedGoal(goal);
    setIsGoalModalOpen(true);
  };

  return (
    <div className="min-h-[100dvh] bg-canvas text-ink font-sans selection:bg-white/30">
      <nav className="border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-ink-2 hover:text-ink">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-brand to-brand-strong rounded-field flex items-center justify-center shadow-lg shadow-brand/20">
                <Heart className="text-ink w-5 h-5 fill-white" />
              </div>
              <span className="font-bold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-brand to-brand-strong">Nexa Casais</span>
            </div>
          </div>
          <button onClick={() => setIsWealthModalOpen(true)} className="p-2 bg-white/10 hover:bg-white/20 text-ink-2 rounded-field transition-colors border border-white/20 flex items-center gap-2 cursor-pointer">
            <Settings className="w-4 h-4" /> <span className="hidden sm:inline text-sm font-medium">Configurar Cofre</span>
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-10 text-center sm:text-left">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2 justify-center sm:justify-start">
              Visão do Casal <Sparkles className="w-5 h-5 text-ink-2" />
            </h1>
            <p className="text-ink-2/70">Onde os sonhos se constroem juntos.</p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <CardCasal title="Patrimônio Conjunto" amount={settings ? formatMoney(settings.joint_wealth) : "R$ 0,00"} icon={<Building className="text-ink-2" />} delay={0.1} />
          <CardCasal title="Reserva de Emergência" amount={settings ? formatMoney(settings.emergency_fund) : "R$ 0,00"} icon={<PiggyBank className="text-pos" />} delay={0.2} />
          <CardCasal title="Despesas da Casa (Mês)" amount={settings ? formatMoney(settings.house_expenses) : "R$ 0,00"} icon={<Home className="text-neg" />} delay={0.3} />
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-6 h-6 text-ink-2" /> Metas em Conjunto
          </h2>
          <button onClick={openNewGoal} className="bg-white/5 hover:bg-white/20 text-ink-2 px-4 py-2 rounded-field transition-colors border border-white/10 flex items-center gap-2 text-sm font-bold cursor-pointer">
            <Plus className="w-4 h-4" /> Nova Meta
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {goals.length === 0 ? (
            <p className="text-ink-3 italic">Nenhuma meta criada ainda. Clique em "Nova Meta"!</p>
          ) : (
            goals.map(goal => (
              <GoalCard 
                key={goal.id} 
                title={goal.title} 
                current={goal.current_amount} 
                target={goal.target_amount} 
                icon={<Target className="w-6 h-6 text-ink" />} 
                color={goal.color} 
                onAddFunds={() => openAddFunds(goal)}
              />
            ))
          )}
        </div>

      </main>

      <CoupleWealthModal isOpen={isWealthModalOpen} onClose={() => setIsWealthModalOpen(false)} currentData={settings} onSave={fetchData} />
      <CoupleGoalModal isOpen={isGoalModalOpen} onClose={() => setIsGoalModalOpen(false)} selectedGoal={selectedGoal} onSave={fetchData} />
    </div>
  );
}

function CardCasal({ title, amount, icon, delay }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay }} className="bg-white/10 border border-white/10 p-6 rounded-card backdrop-blur-sm hover:bg-white/20 hover:border-white/20 transition-all relative overflow-hidden group">
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors"></div>
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-white/5 rounded-inner">{icon}</div>
      </div>
      <p className="text-ink-2 text-sm font-medium mb-1">{title}</p>
      <h3 className="text-3xl font-bold tracking-tight text-ink">{amount}</h3>
    </motion.div>
  );
}

function GoalCard({ title, current, target, icon, color, onAddFunds }: any) {
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  
  return (
    <div className="bg-white/5 border border-white/10 rounded-card p-6 relative overflow-hidden group hover:border-white/30 transition-colors">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 bg-white/5 rounded-inner border border-white/10`}>
            {icon}
          </div>
          <div>
            <h3 className="font-bold text-lg text-ink">{title}</h3>
            <p className="text-sm text-ink-2">Progresso: {percent}%</p>
          </div>
        </div>
        <button onClick={onAddFunds} className="p-2 bg-white/5 hover:bg-white/20 hover:text-ink-2 text-ink-2 rounded-field transition-colors cursor-pointer" title="Adicionar Dinheiro">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="w-full h-3 bg-surface rounded-full overflow-hidden mb-3 border border-white/5">
        <motion.div 
          initial={{ width: 0 }} 
          animate={{ width: `${percent}%` }} 
          transition={{ duration: 1, delay: 0.5 }}
          className={`h-full bg-gradient-to-r from-brand to-brand-strong`}
        ></motion.div>
      </div>
      
      <div className="flex justify-between text-sm font-medium">
        <span className="text-ink">R$ {Number(current).toLocaleString('pt-BR')}</span>
        <span className="text-ink-3">Meta: R$ {Number(target).toLocaleString('pt-BR')}</span>
      </div>
    </div>
  );
}
