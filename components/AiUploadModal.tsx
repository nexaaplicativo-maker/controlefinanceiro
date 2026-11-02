"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, UploadCloud, Camera, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "./Toast";
import { getUserId } from "../lib/session";
import { useModalA11y } from "../hooks/use-modal-a11y";
import { reduzirImagem } from "../lib/imagem";

export function AiUploadModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  if (!isOpen) return null;

  const handleFileSelect = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMessage("");

    try {
      // Reduz antes de enviar: a foto crua do celular costuma passar do corte
      // de corpo da Vercel e nem chegava na rota.
      const arquivo = await reduzirImagem(file);

      const formData = new FormData();
      formData.append("file", arquivo);

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const token = currentSession?.access_token || '';

      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        // A rota responde JSON com `error`. Jogar o corpo cru na tela mostrava
        // chaves e aspas para o usuário.
        const detalhe = await response.json().catch(() => null);
        throw new Error(detalhe?.error || "Não consegui ler esse arquivo. Tente outra foto.");
      }

      const data = await response.json();
      const userId = await getUserId();
      
      if (userId && Array.isArray(data) && data.length > 0) {
        // Marca tudo que saiu desta leitura com o mesmo grupo. É o que permite
        // apagar a fatura inteira depois, sem confirmar compra por compra.
        const importGroup = crypto.randomUUID();

        const transactionsToInsert = data.map((item: any) => ({
          user_id: userId,
          title: item.description || "Despesa lida por IA",
          amount: parseFloat(item.amount || 0),
          category: item.category || "Variáveis",
          // Segundo eixo: onde o dinheiro foi gasto. A rota já normaliza para
          // o vocabulário fechado, então aqui só persiste.
          subcategoria: item.subcategoria || "Outros",
          type: item.type === "income" ? "income" : "expense",
          date: selectedDate,
          import_group: importGroup
        })).filter((t: any) => t.amount > 0);

        // Antes isto anunciava "0 lançamento(s) importados" como sucesso
        // quando todos os itens vinham sem valor — e a pessoa fechava o modal
        // achando que tinha funcionado.
        if (transactionsToInsert.length === 0) {
          throw new Error("Li o arquivo, mas não encontrei nenhum valor. Tente uma foto mais nítida ou com a fatura inteira visível.");
        }

        const { error } = await supabase.from('transactions').insert(transactionsToInsert);
        if (error) throw new Error("Erro ao salvar no banco: " + error.message);

        toast(`✨ ${transactionsToInsert.length} lançamento(s) importados pela IA!`, "success");
      } else {
        throw new Error("A IA não conseguiu extrair os dados da imagem.");
      }

      setIsUploading(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);

    } catch (err: any) {
      console.error(err);
      setIsUploading(false);
      setErrorMessage(err.message || "Erro desconhecido.");
      toast(err.message || "Erro ao processar imagem.", "error");
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!isUploading ? onClose : undefined} />
        
        <motion.div ref={a11yRef} role="dialog" aria-modal="true" initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-neutral-900 border border-indigo-500/30 shadow-2xl shadow-indigo-500/20 rounded-3xl p-6 overflow-hidden">
          
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none"></div>

          <div className="flex justify-between items-center mb-2 relative">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" /> Leitura por IA
            </h2>
            {!isUploading && (
              <button onClick={onClose} aria-label="Fechar" className="p-2 text-neutral-400 hover:text-white bg-white/5 rounded-full transition-colors cursor-pointer"><X className="w-4 h-4" /></button>
            )}
          </div>
          
          <p className="text-neutral-400 text-sm mb-6 relative">
            Tire uma foto ou envie um arquivo.
          </p>

          {isUploading ? (
            <div className="flex flex-col items-center justify-center py-10 relative">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
              <h3 className="text-white font-bold text-lg mb-1">Analisando imagem...</h3>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center justify-center py-10 relative">
              <Sparkles className="w-8 h-8 text-emerald-400 mb-4" />
              <h3 className="text-white font-bold text-lg mb-1">Leitura Concluída!</h3>
            </div>
          ) : (
            <div className="relative">
              {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-4 text-center">
                  {errorMessage}
                </div>
              )}

              <div className="mb-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                <label className="block text-sm font-medium text-neutral-400 mb-2">Mês/Data do Lançamento</label>
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-2 px-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <label className="flex flex-col items-center justify-center p-6 bg-white/5 hover:bg-indigo-500/20 rounded-2xl cursor-pointer">
                  <Camera className="w-6 h-6 text-indigo-400 mb-2" />
                  <span className="font-bold text-white text-sm">Tirar Foto</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
                </label>

                <label className="flex flex-col items-center justify-center p-6 bg-white/5 hover:bg-purple-500/20 rounded-2xl cursor-pointer">
                  <UploadCloud className="w-6 h-6 text-purple-400 mb-2" />
                  <span className="font-bold text-white text-sm">Enviar Arquivo</span>
                  <span className="text-[11px] text-neutral-500 mt-0.5">Foto ou PDF</span>
                  {/* A rota sempre aceitou application/pdf, mas este input era
                      `image/*` — então não havia como nem selecionar uma fatura
                      em PDF. */}
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
                </label>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
