# Publicar no Render

O conversor usa uma interface e uma API. Estes comandos publicam as duas partes
em um único Web Service, sem precisar de chave de API.

## Configuração do serviço

- Service Type: **Web Service**
- Language / Runtime: **Node**
- Branch: **main**
- Root Directory: **deixe vazio**, usando a raiz do repositório
- Build Command: `pnpm install --frozen-lockfile && pnpm run build:render`
- Start Command: `pnpm run start:render`
- Health Check Path: `/api/healthz`

Escolha a instância **Free**, se disponível, para não contratar uma instância paga.
Confira as condições e os limites atuais do Render antes de confirmar.

## Variáveis

Não é necessário cadastrar uma chave de API. A compilação usa `/` como caminho
padrão da interface. O servidor usa a variável `PORT` fornecida pelo Render.

Se já adicionou `BASE_PATH=/` e `PORT=10000`, pode mantê-las.
Não coloque `BASE_PATH=artifacts/conversor-xls`.

## Aplicar a correção a um serviço existente

1. Envie a versão corrigida do código ao GitHub.
2. No Render, abra **Settings** e ajuste os campos acima.
3. Em **Manual Deploy**, escolha **Deploy latest commit**.
4. Espere o estado **Live**.
5. Abra a URL do serviço e teste a conversão.

O código inclui um comando específico para compilar somente o conversor e sua API,
sem incluir o ambiente de prévias de componentes.

A instância gratuita pode parar após um período sem acessos. O primeiro acesso
depois desse período pode demorar enquanto o serviço inicia.
