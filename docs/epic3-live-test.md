# EPIC 3 — configuração do teste real

Este roteiro prepara um teste controlado com o número de teste provisionado pela Meta e o Vertex AI Gemini. A configuração local mantém as aprovações desligadas por padrão e usa um PostgreSQL isolado.

## Estado atual e bloqueios

- A branch já contém os adaptadores reais de WhatsApp Cloud API e Vertex AI Gemini 3.8 Flash.
- Ainda não existem credenciais Meta, número de teste, projeto Google Cloud ou credenciais ADC configurados neste ambiente.
- `DATA_POLICY_V2.operationalReadiness.localDeletion` continua `pending`. A rota de webhook retorna 503 e os adaptadores Gemini/WhatsApp bloqueiam processamento enquanto esse gate estiver fechado.
- O worker expurga conversas expiradas no PostgreSQL. A exclusão de objetos de mídia no Bucket ainda não está implementada e comprovada nesta branch. Não altere o gate para contornar essa pendência.
- A configuração Railway existente é sintética. Este roteiro usa serviços locais e não pede deploy na Railway.

Não habilite tráfego real até haver evidência aprovada de exclusão local, conta Meta e regras do canal verificadas, custos reconciliados e saldo suficiente no Budget. Não use fotos nem dados de clientes.

## Criar acessos de teste

### Meta WhatsApp Cloud API

1. Entre no [Meta for Developers](https://developers.facebook.com/) com a conta autorizada e abra ou crie um app de desenvolvimento com o produto WhatsApp.
2. Na configuração/API Setup do produto, use o número de teste que a própria Meta provisionar. O repositório não contém um número fixo. Adicione seu número pessoal como destinatário autorizado de teste.
3. Registre localmente o número de teste e o `Phone Number ID` exibidos pela Meta. `WHATSAPP_PHONE_NUMBER_ID` é um identificador da API; não é o número de telefone que recebe mensagens.
4. Gere um `WHATSAPP_VERIFY_TOKEN` aleatório e exclusivo para este teste. Configure um callback HTTPS temporário terminado em `/api/webhooks/whatsapp`, informe o mesmo verify token no painel e assine o campo de mensagens (`messages`).
5. Copie o token de acesso, o App Secret, a versão Graph API mostrada/suportada pelo app e o Phone Number ID somente para `.env.epic3.local`. Não cole esses valores no chat nem os adicione ao Git.
6. Confirme as regras de destinatário, janela/templates aplicáveis e o custo do teste pela conta e pelo painel de cobrança antes de marcar os respectivos gates como aprovados.

A Meta informa acesso a números de teste e sandbox no [Developer Hub](https://whatsappbusiness.com/developers/developer-hub/). O número exato só aparece no app que for configurado.

### Google Vertex AI Gemini

1. Use o projeto Google Cloud aprovado para o piloto, habilite a Vertex AI API e confirme faturamento e limites de custo.
2. No computador de desenvolvimento, autentique Application Default Credentials (ADC) para esse projeto. O adaptador usa ADC; não exige uma chave Gemini Developer API.
3. Preencha `GOOGLE_CLOUD_PROJECT` e confirme acesso ao modelo `gemini-3.8-flash` na região `us`. O custo por classificação precisa ser conhecido e reservado no Budget antes de qualquer chamada.
4. Prefira ADC local. Se uma credencial de serviço for necessária, mantenha o arquivo fora do repositório e informe seu caminho em `GOOGLE_APPLICATION_CREDENTIALS`.

## Preparar o ambiente local

1. Copie `.env.epic3.local.example` para `.env.epic3.local` e gere um `DATABASE_PASSWORD` aleatório para esta instância local.
2. Deixe as variáveis de tráfego, conta, custo e regras do canal como `false`. Preencha credenciais e custos apenas localmente, depois de confirmá-los nos painéis oficiais.
3. Inicie somente o PostgreSQL de teste:

   ```powershell
   docker compose --env-file .env.epic3.local -f compose.epic3-local.yaml -p epic3-test up -d db
   ```

4. Em um terminal, compile o worker e inicie o Next.js:

   ```powershell
   npm run build
   npm run dev:epic3
   ```

5. Em outro terminal, inicie o worker com o mesmo arquivo de ambiente:

   ```powershell
   npm run start:worker:epic3
   ```

6. Exponha somente `http://localhost:3000` por um túnel HTTPS temporário. Não exponha o PostgreSQL nem a porta de health do worker. Use a URL HTTPS do túnel no callback da Meta e remova o callback quando terminar.

## Gate antes do envio real

Antes de colocar qualquer flag de tráfego em `true`, verifique e registre:

- `localDeletion` aprovada com evidência para todo o armazenamento local descrito pela política — PostgreSQL e Bucket. A configuração local não abre esse gate.
- A conta Meta, o destinatário de teste, regras de envio, App Secret, verify token e custos confirmados.
- O projeto Vertex AI, região/modelo, credenciais ADC e custo de classificação confirmados.
- Saldo e limites do Budget suficientes para reservar ambas as chamadas. Não use custo `0` sem confirmação da conta/faturamento.

Quando todos os gates estiverem abertos por evidência aprovada, envie do seu número pessoal uma única pergunta sintética que corresponda à FAQ aprovada. Confirme a chegada do webhook, uma classificação real do Gemini, uma única resposta aceita pela Meta e os recibos de entrega. Preserve apenas IDs de correlação/entrega e conciliação de custo; não registre texto, payloads nem credenciais.

Depois do teste, encerre o túnel e remova o callback da Meta. Para apagar o banco local isolado, use:

```powershell
docker compose --env-file .env.epic3.local -f compose.epic3-local.yaml -p epic3-test down --volumes --remove-orphans
```

Esse comando remove o volume exclusivo `epic3-test`; confirme o nome do projeto antes de executá-lo.
