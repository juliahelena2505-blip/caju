# Caju CRM 🌰

CRM pessoal de prospecção fria no Instagram para arquitetos — análise de print com IA, geração de abordagem no seu tom, funil kanban com follow-ups automáticos e dashboard de métricas.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra o endereço que aparecer (geralmente http://localhost:5173).

## Deploy (Vercel ou Netlify)

1. Suba esta pasta para um repositório no GitHub.
2. Na Vercel/Netlify, importe o repositório. Framework: **Vite**. Build: `npm run build`. Pasta de saída: `dist`.
3. Pronto — o app é 100% front-end, sem backend.

## Configuração

- Vá em **Ajustes** e cole sua chave de API da Anthropic (fica só no seu navegador).
- Modelo padrão: Claude Haiku 4.5 (mais barato). Troque para Sonnet 4.6 quando quiser abordagens com escrita mais refinada.

## Importante sobre os dados

Tudo fica no **localStorage do navegador**. Se limpar os dados do navegador, os leads somem. Use **Exportar dados** em Ajustes para fazer backup em JSON (e Importar para restaurar).

O app já vem com leads de exemplo para você ver o funil, os alertas e os gráficos funcionando — apague-os em Ajustes → "Apagar todos os leads" quando for começar de verdade.

## Fluxo

1. Garimpa no Instagram → tira print do perfil.
2. **Analisar Perfil**: sobe o print → IA pontua os 6 critérios → BALEIA / VALE / PASSA.
3. Gera a abordagem no seu tom (3 estilos ou automático) → revisa, copia, envia manualmente.
4. **Funil**: card avança pelas 8 etapas (drag-and-drop ou seletor no card).
5. Follow-ups a cada 2 dias (máx. 3 → Perdido automático), lembrete de reunião 1 dia antes, follow-up de proposta 2 em 2 dias.
6. Em "Respondeu": cola a resposta → IA sugere os 5 critérios de qualificação → você confirma → Lead Qualificado.
7. **Dashboard**: métricas semanais (seg–dom) e mensais (mês-calendário), faturamento, pipeline em aberto e gráficos dos últimos 6 meses.

atualizando deploy
