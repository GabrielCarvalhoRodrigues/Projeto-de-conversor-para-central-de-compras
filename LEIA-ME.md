# Código-fonte — Conversor D7

Este pacote contém o código atual do conversor, em TypeScript.

## Arquivos principais

- `artifacts/api-server/src/routes/convert.ts`: leitura das planilhas e geração dos TXT, ZIP e CSV de demanda.
- `artifacts/conversor-xls/src/App.tsx`: interface, envio da planilha e download.
- `attached_assets/d7_imagem_1782243189521.jpg`: logo utilizada pela interface.

O CSV de demanda usa `Cod;Qtde;Marca;Tipo`, com Marca e Tipo fixos em 1. Seu nome é o nome da planilha original, sem a extensão, seguido de ` CDC.csv`.

## Dependências e execução

Requer Node.js e pnpm. Execute `pnpm install` na raiz para instalar as dependências.

Este é o código-fonte do projeto atual, não um instalador. No Replit, use os fluxos configurados do projeto. Para executar em outro ambiente, configure dois serviços:

- API: `PORT=5000 pnpm --filter @workspace/api-server run dev`
- Interface: `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/conversor-xls run dev`

Fora do Replit, também é necessário configurar um proxy para encaminhar `/api` à API e as demais rotas à interface no mesmo endereço.

O pacote não inclui senhas, variáveis secretas, dependências instaladas nem planilhas enviadas pelos usuários.
