"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, UploadCloud, Camera, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "./Toast";
import { getUserId } from "../lib/session";
import { useModalA11y } from "../hooks/use-modal-a11y";
import { reduzirImagem } from "../lib/imagem";
import { expandirParcelamento, tituloBase, chaveParcela } from "../lib/parcelas";

interface Candidato {
  /** Chave da cobrança parcelada, para não lançar a mesma parcela duas vezes.
   *  `null` em compra à vista, que nunca é descartada por repetição. */
  chave: string | null;
  row: Record<string, any>;
}

/**
 * Tira da lista as parcelas que já existem no banco.
 *
 * É o que torna seguro projetar parcela futura. Ao importar a fatura de
 * dezembro, a parcela "4/10" já foi criada pela projeção de novembro — sem
 * esta conferência, toda compra parcelada seria contada duas vezes, todo mês.
 *
 * Só olha linhas parceladas. Compra à vista repetida é compra repetida mesmo:
 * dá para almoçar duas vezes no mesmo lugar.
 */
async function semParcelasRepetidas(userId: string, candidatos: Candidato[]): Promise<Candidato[]> {
  const parceladas = candidatos.filter(c => c.chave !== null);
  if (parceladas.length === 0) return candidatos;

  const datas = parceladas.map(c => c.row.date as string).sort();

  const { data: existentes, error } = await supabase
    .from('transactions')
    .select('title, date, installment_info')
    .eq('user_id', userId)
    .not('installment_info', 'is', null)
    .gte('date', datas[0])
    .lte('date', datas[datas.length - 1]);

  // Falhou a consulta: importa tudo. Lançamento duplicado o usuário apaga;
  // lançamento que nunca entrou ele não descobre que faltou.
  if (error || !existentes) return candidatos;

  const jaExiste = new Set(
    existentes.map((t: any) => chaveParcela(tituloBase(t.title), t.installment_info, t.date)),
  );

  return candidatos.filter(c => c.chave === null || !jaExiste.has(c.chave));
}

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

        const candidatos: Candidato[] = [];

        for (const item of data) {
          const amount = parseFloat(item.amount || 0);
          if (!(amount > 0)) continue;

          const comum = {
            user_id: userId,
            amount,
            category: item.category || "Variáveis",
            // Segundo eixo: onde o dinheiro foi gasto. A rota já normaliza para
            // o vocabulário fechado, então aqui só persiste.
            subcategoria: item.subcategoria || "Outros",
            type: item.type === "income" ? "income" : "expense",
            import_group: importGroup,
            // Fatura se importa para planejar o pagamento, não depois de
            // pagar. Isto estava implícito, dependendo do padrão da coluna no
            // banco — que não está versionado em lugar nenhum. Se um dia ele
            // virasse `true`, a fatura chegaria quitada e o valor sumiria das
            // contas a vencer sem ninguém notar.
            is_paid: false,
          };

          const parcelas = expandirParcelamento(item.description, selectedDate, item.parcela ?? null);

          // Compra à vista: uma linha, como sempre foi.
          if (parcelas.length === 0) {
            candidatos.push({
              chave: null,
              row: { ...comum, title: item.description || "Despesa lida por IA", date: selectedDate },
            });
            continue;
          }

          // Parcelada: a cobrança deste mês mais as que já estão contratadas.
          // Todas no mesmo installment_group, para a tela de cartões e a
          // exclusão de série enxergarem a compra inteira.
          const installmentGroup = crypto.randomUUID();
          const base = tituloBase(item.description);

          for (const parcela of parcelas) {
            candidatos.push({
              chave: chaveParcela(base, parcela.installment_info, parcela.data),
              row: {
                ...comum,
                title: parcela.titulo,
                date: parcela.data,
                installment_group: installmentGroup,
                installment_info: parcela.installment_info,
                // Atual e futuras nascem em aberto pelo mesmo motivo; o
                // `is_paid` já vem de `comum`.
              },
            });
          }
        }

        // Antes isto anunciava "0 lançamento(s) importados" como sucesso
        // quando todos os itens vinham sem valor — e a pessoa fechava o modal
        // achando que tinha funcionado.
        if (candidatos.length === 0) {
          throw new Error("Li o arquivo, mas não encontrei nenhum valor. Tente uma foto mais nítida ou com a fatura inteira visível.");
        }

        const aproveitados = await semParcelasRepetidas(userId, candidatos);

        if (aproveitados.length === 0) {
          throw new Error("Todas as parcelas desta fatura já estavam lançadas. Nada foi duplicado.");
        }

        const transactionsToInsert = aproveitados.map(c => c.row);
        const { error } = await supabase.from('transactions').insert(transactionsToInsert);
        if (error) throw new Error("Erro ao salvar no banco: " + error.message);

        const futuras = transactionsToInsert.filter((t: any) => t.date !== selectedDate).length;
        const agora = transactionsToInsert.length - futuras;

        toast(
          futuras > 0
            ? `✨ ${agora} lançamento(s) importados e ${futuras} parcela(s) futura(s) já projetada(s)!`
            : `✨ ${transactionsToInsert.length} lançamento(s) importados pela IA!`,
          "success",
        );
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
      <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={!isUploading ? onClose : undefined} />
        
        <motion.div ref={a11yRef} role="dialog" aria-modal="true" initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full sm:max-w-md sheet-panel sheet-grab shadow-[0_24px_60px_rgba(0,0,0,0.65)] rounded-t-card sm:rounded-card p-6 pb-safe sm:pb-6 overflow-hidden">
          
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-brand/10 to-transparent pointer-events-none"></div>

          <div className="flex justify-between items-center mb-2 relative">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand" /> Leitura por IA
            </h2>
            {!isUploading && (
              <button onClick={onClose} aria-label="Fechar" className="p-2 text-ink-2 hover:text-ink bg-white/5 rounded-full transition-colors cursor-pointer"><X className="w-4 h-4" /></button>
            )}
          </div>
          
          <p className="text-ink-2 text-sm mb-6 relative">
            Tire uma foto ou envie um arquivo.
          </p>

          {isUploading ? (
            <div className="flex flex-col items-center justify-center py-10 relative">
              <Loader2 className="w-12 h-12 text-brand animate-spin mb-4" />
              <h3 className="text-ink font-bold text-lg mb-1">Analisando imagem...</h3>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center justify-center py-10 relative">
              <Sparkles className="w-8 h-8 text-pos mb-4" />
              <h3 className="text-ink font-bold text-lg mb-1">Leitura Concluída!</h3>
            </div>
          ) : (
            <div className="relative">
              {errorMessage && (
                <div className="bg-neg/10 border border-neg/20 text-neg p-3 rounded-field text-sm mb-4 text-center">
                  {errorMessage}
                </div>
              )}

              <div className="mb-4 bg-white/5 p-4 rounded-inner border border-white/10">
                <label className="block text-sm font-medium text-ink-2 mb-2">Mês/Data do Lançamento</label>
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-field py-2 px-4 text-ink focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <label className="flex flex-col items-center justify-center p-6 bg-white/5 hover:bg-brand/20 rounded-inner cursor-pointer">
                  <Camera className="w-6 h-6 text-brand mb-2" />
                  <span className="font-bold text-ink text-sm">Tirar Foto</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
                </label>

                <label className="flex flex-col items-center justify-center p-6 bg-white/5 hover:bg-brand/20 rounded-inner cursor-pointer">
                  <UploadCloud className="w-6 h-6 text-brand mb-2" />
                  <span className="font-bold text-ink text-sm">Enviar Arquivo</span>
                  <span className="text-xs text-ink-3 mt-0.5">Foto ou PDF</span>
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
