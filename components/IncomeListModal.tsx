"use client";

import { TrendingUp, Edit2, Trash2, CheckCircle2, Clock } from "lucide-react";
import { Sheet } from "./ui/Sheet";
import { EmptyState } from "./ui/Surface";

/**
 * As receitas do mês, para gerenciar.
 *
 * Difere da folha de detalhe do pilar (`PillarDetailModal`, aberta pelo card
 * inteiro): esta abre pelo lápis e é onde se APAGA e se marca recebido. Lá é
 * conferência, aqui é gestão — e é por isso que a lixeira existe neste arquivo
 * e não naquele.
 *
 * A CASCA VEM DA FOLHA
 * Fundo, painel, alça, cabeçalho, X, rolagem, trap de foco e animação vêm de
 * `ui/Sheet`. Antes estavam copiados aqui à mão.
 */

/** Área de toque de 44x44 com ícone de 16px, repetida nas três ações da linha.
 *  O mínimo do sistema de design é 44px; `p-2` em volta de um ícone de 16 dava
 *  32. Numa lista densa, oito pixels faltando de cada lado é o toque que cai
 *  na linha vizinha — e aqui uma das ações apaga. */
const ACAO = 'grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-field transition-colors';

export function IncomeListModal({ isOpen, onClose, incomes, onEdit, onDelete, onTogglePaid, formatMoney }: any) {
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Suas Receitas"
      subtitle={
        incomes.length === 0
          ? 'Nenhuma receita neste mês'
          : `${incomes.length} ${incomes.length === 1 ? 'receita' : 'receitas'} neste mês`
      }
      icon={<TrendingUp className="h-5 w-5 text-pos" />}
      largura="md"
    >
      {incomes.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-6 w-6" />}
          title="Nenhuma receita registrada neste mês."
          description="Lance o salário e o que mais entrou para o painel conseguir calcular sua capacidade de poupança."
        />
      ) : (
        <div className="space-y-3">
          {incomes.map((item: any) => (
            <div
              key={item.id}
              className={`flex items-center justify-between rounded-inner border p-3 text-sm transition-colors ${
                item.is_paid === false ? 'border-warn/20 bg-warn/5' : 'border-line bg-white/5'
              }`}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1 pr-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${item.is_paid === false ? 'bg-warn' : 'bg-pos'}`}
                    aria-hidden
                  />
                  {/* Duas linhas, não uma. São três ações de 44px à direita:
                      em 360px sobravam ~130px para o título e "Vale Academia"
                      virava "Vale…", que não identifica a receita.

                      E saiu daqui o selo "PEND.": o sistema de design pede o
                      estado por um ponto, "nunca por fundo colorido", e a
                      linha já dizia pendente de quatro maneiras ao mesmo
                      tempo — ponto âmbar, fundo âmbar, selo e ícone de
                      relógio. O selo era o único que custava largura do
                      título, e o único redundante com todos os outros. */}
                  <span className="line-clamp-2 font-semibold text-ink">
                    {item.title}
                    {/* O ponto colorido sozinho não diz nada para leitor de
                        tela nem para quem nunca viu a legenda. */}
                    <span className="sr-only">{item.is_paid === false ? ' (pendente)' : ' (recebido)'}</span>
                  </span>
                </div>
                <span className="text-lg font-bold text-pos tnum">+ {formatMoney(item.amount)}</span>
              </div>

              <div className="flex shrink-0 items-center">
                {item.is_paid !== undefined && (
                  <button
                    onClick={() => onTogglePaid(item.id, item.is_paid)}
                    className={`${ACAO} ${item.is_paid ? 'text-pos/60 hover:bg-pos/10 hover:text-pos' : 'text-warn/80 hover:bg-warn/10 hover:text-warn'}`}
                    aria-label={item.is_paid ? `Marcar ${item.title} como pendente` : `Marcar ${item.title} como recebido`}
                    title={item.is_paid ? 'Marcar como pendente' : 'Marcar como recebido'}
                  >
                    {item.is_paid ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  </button>
                )}
                <button
                  onClick={() => { onEdit(item); onClose(); }}
                  className={`${ACAO} text-brand/60 hover:bg-brand/10 hover:text-brand`}
                  aria-label={`Editar ${item.title}`}
                  title="Editar"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className={`${ACAO} text-neg/60 hover:bg-neg/10 hover:text-neg`}
                  aria-label={`Excluir ${item.title}`}
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
