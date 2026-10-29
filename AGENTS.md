# AGENTS.md — Matriz

Instruções para coding agents que trabalhem neste repositório. Aplicam-se a todas as tarefas, em qualquer fase do projeto.

O humano responsável pelo projeto (*human-in-the-loop*) aprova os planos, as decisões e as operações sensíveis. Na dúvida, pergunta-se; não se presume.

---

## 1. Consultar a documentação antes de agir

Antes de iniciar qualquer tarefa:

1. Ler o `README.md` e a documentação em `docs/`. A ordem de leitura, a precedência entre fontes e o tratamento das decisões pendentes estão definidos em `README.md` › *Utilização como contexto*.
2. Identificar os elementos da especificação abrangidos pela tarefa (US, CA, RN, RF, RNF, SEC, R) e as decisões pendentes (D, DT) ou pressupostos (P) de que depende.
3. Confirmar que a tarefa respeita as restrições (`docs/constraints.md` §1) e a fase atual do projeto.

A documentação é a fonte de verdade. As lacunas não se preenchem com suposições, conhecimento genérico ou o comportamento de outras ferramentas semelhantes.

## 2. Só o que está aprovado

- Implementa-se apenas o que está **Confirmado** na especificação ou foi aprovado explicitamente pelo humano.
- Requisitos **Propostos** e **Pressupostos** não são factos: só servem de base a trabalho depois de aprovados.
- Funcionalidades fora do âmbito, decisões pendentes e escolhas técnicas não tomadas (tecnologias, dependências, arquitetura, modelo de dados) são *no-go*. O agente pode propor; não decide.

## 3. Discrepâncias: interromper e reportar

Perante uma discrepância, o agente interrompe o trabalho imediatamente, não tenta contorná-la e reporta-a ao humano, incluindo o que já tiver sido alterado.

É uma discrepância, por exemplo:

- a tarefa contraria a especificação ou este ficheiro, ou duas partes da especificação contradizem-se;
- a tarefa depende de uma decisão pendente, de um requisito não aprovado ou de informação em falta;
- o estado do repositório não corresponde ao descrito na documentação;
- avançar exigiria assumir algo que não está documentado nem aprovado.

O relatório indica o que foi encontrado, onde (ficheiro e IDs), o impacto e, quando existam, as opções possíveis. O trabalho só é retomado após decisão do humano; se a decisão alterar a especificação, é registada no documento respetivo.

## 4. Plano antes de alterações significativas

Antes de uma alteração significativa, o agente apresenta um plano e aguarda aprovação. É significativa, entre outras, uma alteração que cria ou remove ficheiros, abrange vários ficheiros, introduz estrutura nova ou altera o sentido de requisitos, regras ou decisões.

O plano indica:

- o objetivo e os elementos da especificação abrangidos (IDs);
- os ficheiros a criar, alterar ou remover;
- a abordagem;
- os pressupostos e riscos;
- como o resultado será verificado.

Se o plano tiver de mudar de forma relevante durante a execução, é apresentado de novo.

## 5. Âmbito das alterações

Alteram-se apenas os ficheiros necessários à tarefa. Um ficheiro fora da tarefa só é alterado quando for indispensável e depois de o humano o autorizar, com a necessidade justificada.

## 6. Operações destrutivas ou sensíveis

Exigem sempre autorização prévia do humano, pedida para cada operação e explicando o que será feito e as consequências. A aprovação de um plano só a dispensa se o plano identificar essa operação explicitamente.

Incluem, por exemplo:

- apagar ou sobrescrever ficheiros ou dados;
- reescrever o histórico Git ou publicar alterações (push, pull requests);
- operar sobre bases de dados, ambientes ou serviços externos;
- alterar permissões, configurações de segurança ou estas instruções;
- qualquer ação difícil de reverter.

## 7. Credenciais e informação confidencial

- Credenciais, chaves, tokens e outra informação confidencial podem ser usados quando a tarefa o exige, mas nunca são expostos: não aparecem em ficheiros, commits, mensagens, logs, outputs nem exemplos. Referem-se pela sua localização (p. ex. o nome de uma variável de ambiente), nunca pelo valor.
- Se o agente encontrar informação deste tipo exposta, não a reproduz e informa o humano.
- Os requisitos de segurança e privacidade (`docs/constraints.md` §3) aplicam-se também ao trabalho do agente.

## 8. Comunicação

No plano e no fim de cada tarefa, o agente comunica de forma explícita:

- **Pressupostos** — as interpretações feitas e em que se baseiam. Um pressuposto que determine o resultado e não esteja documentado nem aprovado é uma discrepância (§3).
- **Alterações** — os ficheiros alterados e o que mudou, com referência aos IDs.
- **Verificações** — o que foi verificado, como e com que resultado. O que não foi possível verificar é dito como tal.
