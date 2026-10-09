# Revisão adversarial — seams entre módulos

## Veredito

O spine estabelece boas invariantes, mas deixa contratos de execução que dois módulos podem implementar de formas incompatíveis sem violar o texto dos ADs. Recomendo fechar os três achados altos antes de usá-lo como contrato de implementação; o achado médio deve ser resolvido antes de integrar o envio pelo canal.

## Achados

### ADV-1 — Consentimento não está ligado à foto e à ação de processamento

**Severidade: Alta · AD-5**

**Implementações compatíveis com o texto atual:** Conversas guarda consentimento afirmativo por cliente e fluxo, com versão e horário, e pergunta se a cliente é adulta e envia a própria foto. Retratos recebe `cliente_adulta`, `foto_propria` e `consentimento_ativo` no caso de uso e verifica esses valores antes de chamar IA. Uma segunda implementação igualmente compatível guarda esses mesmos fatos por mensagem recebida e exige que a foto pertença à mensagem que contém a resposta afirmativa.

Ambas registram os campos exigidos e não processam menores ou fotos de terceiros quando a evidência disponível indica isso. Ainda assim, divergem sobre se consentimento e elegibilidade de uma conversa valem para outra foto, outro pedido, uma nova versão dos termos ou outro destino de uso. Um fluxo reutilizado pode encaminhar ao provedor uma foto posterior que não estava coberta pela confirmação registrada.

**Fechamento sugerido:** definir um contrato de evidência de consentimento com sujeito, conversa/pedido, finalidade, versão dos termos e instante; vincular a verificação de elegibilidade a cada objeto de foto recebido; e exigir que a autorização de processamento aponte para essas evidências e para o destino externo. Revogação ou troca de foto invalida a autorização ainda não executada. A representação concreta pode ficar para a implementação.

### ADV-2 — Reserva de orçamento não tem identidade nem ciclo de vida comum com a ação paga

**Severidade: Alta · AD-3, AD-6**

**Implementações compatíveis com o texto atual:** Orçamento reserva uma única vez o custo máximo estimado de uma solicitação de retrato, incluindo o número configurado de tentativas; Retratos consome essa reserva para cada chamada do provedor e liquida o total ao encerrar o trabalho. Outra implementação faz uma reserva independente para cada tentativa no worker, considerando a geração lógica como agrupamento de tarefas. Ambas reservam antes de ação paga, aplicam os limites atomicamente e bloqueiam custos desconhecidos.

Ao conectar os módulos, a primeira pode apresentar novamente uma reserva já coberta pelo pacote; a segunda pode cobrar duas reservas pelo mesmo trabalho quando uma tentativa é reenfileirada após timeout. Uma implementação também pode liberar a reserva ao encerrar o job enquanto a fatura do provedor permanece desconhecida. O spine não fixa a chave de idempotência compartilhada nem quem liquida/libera uma reserva após falha ou reconciliação.

**Fechamento sugerido:** cada ação com custo deve ter um identificador estável e uma única reserva autoritativa, com limite que cubra todas as tentativas externas possíveis; novas tentativas reutilizam a ação/reserva ou criam subações explicitamente vinculadas. A reserva só pode ser liquidada/liberada uma vez, após resultado terminal e conciliação de qualquer custo pendente; custo não conciliado mantém o valor comprometido e o bloqueio aplicável.

### ADV-3 — Exclusão mútua do atendimento não impede envio automático já enfileirado

**Severidade: Alta · AD-2, AD-3, AD-7**

**Implementações compatíveis com o texto atual:** Operação dos Sócios grava a tomada de controle e um lock durável por `conversation_id`; Conversas mantém seu próprio estado de pausa e consulta o lock ao criar respostas novas. Outra implementação faz a tomada por `customer_id`, pausa automações futuras, e verifica o lock apenas quando cria o job de resposta. Em ambos os casos, o parceiro obtém um lock e o bot deixa de produzir novas respostas depois da pausa.

Se o worker já tiver retirado um job da fila, ou o job estiver em trânsito ao canal quando o sócio assume, ele ainda pode enviar uma resposta automática durante o atendimento humano. As duas implementações têm locks válidos, mas não compartilham a definição da unidade de exclusão nem uma checagem final de envio que invalide trabalho antigo.

**Fechamento sugerido:** definir a conversa como escopo canônico da tomada e manter uma versão/época durável de controle. O envio automatizado deve validar e reivindicar atomicamente essa versão imediatamente antes do efeito externo; a tomada incrementa a versão e invalida jobs anteriores. Retomada explícita cria nova versão. O caso de uso público que altera esse estado deve pertencer a um único módulo, sem projeções locais como autoridade.

### ADV-4 — “Confirmação do canal” pode significar aceitação ou entrega

**Severidade: Média · AD-3, AD-9**

**Implementações compatíveis com o texto atual:** Retratos marca uma entrega como concluída após resposta HTTP de aceitação do provedor WhatsApp e associa o ID externo retornado. Outra implementação só conclui após receber o recibo de status `delivered` do webhook. Ambas aguardam confirmação do canal, registram IDs externos e usam tentativas idempotentes.

Os módulos superiores podem então informar à cliente ou aos sócios estados diferentes para o mesmo evento: mensagem aceita na fila do provedor versus mensagem entregue ao dispositivo. A semântica de falha e reenvio também diverge.

**Fechamento sugerido:** separar estados `submitted/accepted`, `delivered`, `read` (se fornecido) e `failed`; definir qual estado satisfaz “entrega concluída” no fluxo de retrato. Correlacionar status pelo ID externo, aceitar eventos duplicados/fora de ordem e nunca regredir estado terminal sem reconciliação explícita. Se o provedor não oferece recibo de entrega, representar aceitação como tal, sem afirmar entrega confirmada.

## Limite desta revisão

Os achados tratam de contratos que afetam a composição dos módulos. Não escolhem provedor, banco, fila ou schema físico, que permanecem decisões abertas no spine.


## Verificação posterior — 2026-10-09

Reli o spine atualizado. Os quatro achados originais foram tratados:

- **ADV-1 — vínculo entre consentimento e foto: corrigido.** AD-5 vincula o consentimento ao sujeito, conversa/pedido, finalidade, versão dos termos e horário. Retratos vincula a autorização à foto exata, à elegibilidade por imagem e ao destino externo, valida consentimento ativo antes do envio e invalida trabalho ainda não enviado após troca de foto ou revogação.
- **ADV-2 — ciclo de vida da reserva de orçamento: corrigido.** AD-6 define ID estável da ação com custo, reserva autoritativa única, tentativas/subações vinculadas, reserva/liquidação/liberação idempotentes e compromisso até resultado terminal e conciliação.
- **ADV-3 — corrida entre takeover e envio: corrigido.** AD-2 atribui a Operação dos Sócios a propriedade do estado de controle. AD-7 define escopo canônico e versão da conversa, invalida envios antigos na fila, serializa takeover com despacho e exige revalidação da versão antes do envio.
- **ADV-4 — mensagem aceita versus entregue: substancialmente corrigido.** AD-3 distingue aceito, entregue, lido e falho; exige recibo explícito de entrega e tolerância a duplicatas e chegada fora de ordem. Ainda falta a regra de precedência entre recibos conflitantes, descrita abaixo.

### Costuras ainda abertas

#### ADV-5 — Idempotência do pagamento não está vinculada à identidade da entrega

**Severidade: Alta · AD-3, AD-4**

As regras exigem deduplicar eventos, mas não fixam qual chave de negócio estável impede que eventos autenticados distintos para o mesmo pagamento autorizem a mesma entrega mais de uma vez. Uma implementação deduplica e enfileira pelo ID do webhook do provedor, e Retratos é idempotente pelo ID do job. Outra deduplica pelo ID estável do pagamento/transação e permite uma autorização de geração por unidade comprada. Ambas tratam IDs de evento duplicados e tornam cada job idempotente; IDs de evento diferentes para o mesmo pagamento confirmado ainda podem produzir resultados distintos na primeira implementação.

**Fechamento sugerido:** definir a identidade do pagamento e uma chave única de autorização da entrega (por exemplo, item do pedido/unidade de entrega) entre Pedidos/Pagamentos e Retratos. Eventos diferentes do mesmo pagamento devem convergir para essa autorização. Definir como resolver um segundo pagamento legítimo após o pedido já estar atendido, por exemplo, reembolso ou escalação manual, em vez de autorizar implicitamente outra geração.

#### ADV-6 — Não há dono nem referência comum para a identidade da cliente

**Severidade: Média · AD-2, AD-4, AD-5, AD-6**

AD-2 atribui donos a conversa, pedido/pagamento, retrato, operação dos sócios e orçamento, mas não a identidade canônica da cliente nem o vínculo entre identidades de canal. AD-4 aplica limites de prévia/geração “por cliente”; AD-5 registra um sujeito de consentimento; direitos de dados precisam localizar os registros desse sujeito. Uma implementação usa o ID de remetente WhatsApp do provedor como chave de cliente em todos os módulos. Outra cria IDs de cliente por pedido a partir dos dados de contato e vincula conversas por telefone. Ambas mantêm escritas dentro de cada módulo e usam IDs internos, mas a mesma pessoa pode contar como clientes diferentes para limites, consentimento e busca de direitos de dados.

**Fechamento sugerido:** nomear um módulo dono da identidade de cliente/sujeito e expor um ID interno estável por casos de uso públicos. Identidades específicas de canal e qualquer vínculo aprovado devem mapear para esse ID; consentimento, pedidos, limites por cliente e solicitações de direitos devem referenciá-lo. Telefone e IDs do provedor permanecem identificadores de canal, sem serem chaves de cliente derivadas independentemente.

#### ADV-7 — Eventos fora de ordem não têm precedência de transição definida

**Severidade: Média · AD-3**

Os novos estados e a exigência de recibo explícito corrigem a ambiguidade anterior, mas “tolerar chegada fora de ordem” não fixa precedência entre eventos de estado conflitantes. Um adaptador mantém estado monotônico (entregue não regride para aceito ou falho, e lido sucede entregue); outro aplica timestamps do provedor ou a ordem de observação. Ambos deduplicam, correlacionam IDs e aceitam eventos fora de ordem, mas podem chegar a estados finais diferentes quando recibos conflitantes chegam atrasados.

**Fechamento sugerido:** especificar transições/precedência permitidas para cada estado da mensagem, incluindo recibos tardios de falha/aceitação após entrega, e um caminho explícito de conciliação para evidências contraditórias do provedor.

Nenhuma outra costura incompatível foi confirmada nesta revisão. O spine permaneceu sem alterações.


## Verificação final — 2026-10-09

Reli novamente o spine após os fechamentos de ADV-5 a ADV-7. **Os sete achados estão fechados no nível do spine; não identifiquei outra costura material nesta revisão.**

- **ADV-1 a ADV-3:** os fechamentos anteriores permanecem presentes: autorização ligada à foto e ação; reserva de custo única por ação; takeover serializado com despacho e invalidação de respostas antigas.
- **ADV-4 e ADV-7:** AD-3 agora define precedência por evidência: aceito não regride entrega/leitura; leitura implica entrega; evidência de entrega/leitura vence falha conflitante para o estado mostrado à cliente e abre conciliação; falha só vence sem evidência de entrega. Isso elimina a divergência de estado final para recibos fora de ordem.
- **ADV-5:** AD-4 define uma autorização de entrega por item pago, convergência de eventos/transações repetidos e escalação de novo pagamento após atendimento do item, sem geração extra automática.
- **ADV-6:** AD-2 atribui a Conversas o ID interno estável da cliente e o vínculo de identidades WhatsApp, exigindo seu uso comum por pedidos, consentimentos, limites, custos e direitos de dados. A verificação para associar novo número está identificada como pré-requisito de produção em Deferred.

A matriz de permissões dos sócios e a verificação para vincular identidades adicionais estão explicitamente pendentes antes do painel em produção; não são escolhas independentes deixadas para os módulos durante a implementação inicial. O spine permaneceu sem alterações nesta verificação.
