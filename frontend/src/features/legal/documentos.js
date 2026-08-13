/**
 * Termos de uso e política de privacidade.
 *
 * Texto em dado, e não em JSX, por dois motivos: a página é um `map` burro
 * sobre esta estrutura (então os dois documentos não podem divergir de
 * formatação), e mudar uma cláusula não mexe em componente nenhum.
 *
 * `VERSAO` espelha `VERSAO_DOS_TERMOS` de backend/app/core/config.py, que é o
 * que fica gravado no `termos_versao` de quem aceita. Mudou o texto de forma
 * relevante? Sobe nos dois lugares.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ISTO É UM RASCUNHO E PRECISA DE REVISÃO JURÍDICA ANTES DE VALER.
 *
 * Os trechos entre [[colchetes]] são dados da empresa que ainda não existem.
 * E há duas decisões que um advogado precisa tomar, não um desenvolvedor:
 *
 *   1. QUEM É O CONTROLADOR dos dados do aluno. O texto abaixo assume que o
 *      personal é o controlador e o FitzPRO é operador (LGPD art. 5º, VI e
 *      VII) — é o arranjo mais comum em SaaS multi-tenant, e o que espelha o
 *      sistema, onde o personal cadastra o aluno e decide o que registrar.
 *      Se a decisão for outra, muda quem responde por pedido de titular e por
 *      incidente de segurança.
 *
 *   2. ALUNOS MENORES DE IDADE. O art. 14 exige consentimento específico de
 *      um dos pais ou responsável para crianças. Hoje o sistema não pergunta
 *      idade antes do aceite, e a data de nascimento é opcional — ou seja, a
 *      cláusula abaixo descreve uma regra que o código ainda não aplica.
 * ────────────────────────────────────────────────────────────────────────────
 */

export const VERSAO = "2026-08-13";
export const VIGENTE_DESDE = "13 de agosto de 2026";

export const EMPRESA = {
  nome: "[[RAZÃO SOCIAL]]",
  cnpj: "[[CNPJ]]",
  email: "[[email de contato]]",
  encarregado: "[[nome e e-mail do encarregado de dados (DPO)]]",
  foro: "[[comarca]]",
};

export const TERMOS = {
  slug: "termos",
  titulo: "Termos de Uso",
  resumo:
    "As regras de uso do FitzPRO: o que a plataforma faz, o que é responsabilidade de quem usa e o que não é responsabilidade nossa.",
  secoes: [
    {
      titulo: "1. Quem somos e o que é o FitzPRO",
      paragrafos: [
        `O FitzPRO é operado por ${EMPRESA.nome}, inscrita no CNPJ ${EMPRESA.cnpj} ("nós").`,
        "O FitzPRO é uma ferramenta de organização: o personal trainer cadastra alunos, prescreve treinos e planos alimentares, registra avaliações físicas e acompanha a execução. O aluno consulta o que foi prescrito e registra o que fez.",
        "Somos uma ferramenta de software. Não prestamos serviço de saúde, não prescrevemos exercício ou dieta e não avaliamos ninguém.",
      ],
    },
    {
      titulo: "2. Contas: personal e aluno",
      paragrafos: [
        "Há dois tipos de conta. A conta de personal é criada pela própria pessoa e é responsável por tudo que acontece dentro dela.",
        "A conta de aluno é criada pelo personal, que informa nome, e-mail e telefone. O aluno recebe um convite por e-mail e define a própria senha no primeiro acesso — o personal não conhece a senha do aluno.",
        "Cada conta é individual e intransferível. Você é responsável por manter sua senha em sigilo e por tudo que for feito com ela. Se suspeitar de acesso indevido, troque a senha imediatamente e nos avise.",
        "Para criar conta é preciso ter pelo menos 18 anos. Alunos menores de idade só podem ser cadastrados com consentimento de um dos pais ou do responsável legal, que o personal é responsável por obter.",
      ],
    },
    {
      titulo: "3. Isenção de responsabilidade sobre saúde e treino",
      destaque: true,
      paragrafos: [
        "Esta é a cláusula mais importante deste documento.",
        "Todo treino, dieta, carga, série, repetição e recomendação que aparece no FitzPRO foi criado pelo personal trainer responsável pelo aluno — nunca por nós. Não conferimos, aprovamos nem revisamos nenhuma prescrição.",
        "Sugestões automáticas do sistema, como o indicativo de que um exercício está pronto para subir a carga, são cálculos sobre o que já foi registrado. São informação para o personal decidir, nunca uma recomendação nossa, e o sistema não altera prescrição sozinho.",
        "O FitzPRO não substitui acompanhamento médico. Antes de iniciar ou mudar um programa de exercícios ou alimentação, procure orientação profissional adequada. Se sentir dor, tontura ou qualquer sintoma durante o treino, pare e procure ajuda.",
        "O personal é o responsável técnico pelo que prescreve, incluindo por atuar dentro de sua habilitação profissional. Prescrição alimentar, em particular, é atividade privativa de nutricionista, e usar a funcionalidade de dietas não altera essa exigência legal.",
      ],
    },
    {
      titulo: "4. Uso aceitável",
      paragrafos: [
        "Você concorda em não usar o FitzPRO para: cadastrar pessoas sem autorização delas; enviar conteúdo ilegal, ofensivo ou de terceiros sem permissão; tentar acessar dados de outra conta; automatizar acesso de forma a prejudicar o serviço; ou fazer engenharia reversa da plataforma.",
        "O catálogo de exercícios exibido na plataforma vem da base pública free-exercise-db, distribuída sob licença Unlicense, e as imagens são carregadas do repositório de origem.",
      ],
    },
    {
      titulo: "5. Conteúdo e propriedade",
      paragrafos: [
        "O que você cria continua seu: treinos, dietas, avaliações e registros pertencem a quem os criou. Você nos concede apenas a permissão necessária para armazenar e exibir esse conteúdo dentro da plataforma, para você e para as pessoas que devem vê-lo.",
        "A plataforma em si — código, marca, layout e organização — é nossa, e nada aqui transfere isso.",
      ],
    },
    {
      titulo: "6. Planos, cobrança e alterações",
      paragrafos: [
        "Os planos e valores exibidos na plataforma podem mudar. Alterações de preço são comunicadas com antecedência e valem a partir do ciclo seguinte.",
        "[[Esta seção precisa ser completada quando a cobrança existir: forma de pagamento, ciclo, política de reembolso e o que acontece com os dados quando a assinatura termina. Hoje nenhum pagamento é processado pela plataforma.]]",
      ],
    },
    {
      titulo: "7. Encerramento",
      paragrafos: [
        "Você pode encerrar sua conta quando quiser. O personal pode desativar a conta de um aluno; a desativação impede o acesso, mas preserva o histórico do aluno para o personal.",
        "Podemos suspender ou encerrar uma conta que viole estes termos, que ponha em risco outros usuários ou a segurança da plataforma, avisando sempre que for possível.",
      ],
    },
    {
      titulo: "8. Limitação de responsabilidade",
      paragrafos: [
        "O FitzPRO é fornecido no estado em que se encontra. Trabalhamos para mantê-lo disponível e correto, mas não garantimos funcionamento ininterrupto nem ausência de falhas.",
        "Não respondemos por lesões, danos à saúde ou resultados obtidos ou não obtidos a partir de treinos e dietas prescritos por profissionais dentro da plataforma, nem por decisões tomadas com base nos dados exibidos.",
        "Nada nestes termos exclui direitos que a lei garante e não permite afastar, especialmente os do Código de Defesa do Consumidor.",
      ],
    },
    {
      titulo: "9. Mudanças nestes termos",
      paragrafos: [
        "Podemos alterar estes termos. Quando a mudança for relevante, publicamos a nova versão com data e pedimos um novo aceite no próximo acesso.",
        `Guardamos qual versão cada pessoa aceitou e quando. A versão vigente é ${VERSAO}, em vigor desde ${VIGENTE_DESDE}.`,
      ],
    },
    {
      titulo: "10. Lei aplicável e foro",
      paragrafos: [
        `Estes termos são regidos pela lei brasileira. Fica eleito o foro da comarca de ${EMPRESA.foro} para dirimir controvérsias, sem prejuízo do direito do consumidor de demandar em seu próprio domicílio.`,
        `Dúvidas: ${EMPRESA.email}.`,
      ],
    },
  ],
};

export const PRIVACIDADE = {
  slug: "privacidade",
  titulo: "Política de Privacidade",
  resumo:
    "Quais dados o FitzPRO guarda, por que guarda, com quem compartilha e como você exerce seus direitos sob a LGPD.",
  secoes: [
    {
      titulo: "1. Quem trata seus dados",
      paragrafos: [
        `${EMPRESA.nome} (CNPJ ${EMPRESA.cnpj}) desenvolve e mantém o FitzPRO.`,
        "Em relação aos dados do aluno, o personal trainer que o cadastrou atua como controlador: é ele quem decide cadastrar, o que registrar e por quanto tempo manter. Atuamos como operador, tratando esses dados conforme as instruções do personal e o necessário para a plataforma funcionar.",
        "Em relação aos dados da conta do próprio personal, nós somos o controlador.",
        `Encarregado de dados (DPO): ${EMPRESA.encarregado}.`,
      ],
    },
    {
      titulo: "2. Dados que tratamos",
      destaque: true,
      paragrafos: [
        "Dados de cadastro: nome, e-mail, telefone, CPF, endereço, data de nascimento, sexo e foto de perfil.",
        "Dados de saúde e do corpo: peso, altura, percentual de gordura, massa muscular, medidas corporais, fotos de evolução e o objetivo do aluno.",
        "Dados de execução: quais treinos foram feitos, quando, por quanto tempo, com qual carga e quantas séries; e quais refeições foram registradas.",
        "Dados técnicos: registros de acesso e de uso necessários para operar e proteger o serviço.",
      ],
      aviso:
        "Dados de saúde, incluindo medidas corporais e fotos de evolução, são dados pessoais sensíveis (LGPD, art. 5º, II). Eles só são tratados com o seu consentimento específico e destacado, dado no seu primeiro acesso, e você pode retirá-lo a qualquer momento.",
    },
    {
      titulo: "3. Por que tratamos, e com qual base legal",
      paragrafos: [
        "Para executar o serviço contratado — criar sua conta, exibir seus treinos e dietas, registrar sua execução e mostrar sua evolução: base legal de execução de contrato (art. 7º, V).",
        "Para tratar dados de saúde e de composição corporal: base legal de consentimento específico e destacado (art. 11, I).",
        "Para enviar e-mails operacionais, como convite de acesso e redefinição de senha: execução de contrato. Não usamos seus dados para publicidade e não enviamos marketing sem pedir antes.",
        "Para segurança, prevenção a fraude e cumprimento de obrigações legais: legítimo interesse e obrigação legal.",
      ],
    },
    {
      titulo: "4. Quem tem acesso",
      paragrafos: [
        "Seus dados de aluno são visíveis para você e para o personal que o cadastrou. Nenhum outro personal da plataforma tem acesso a eles, e nenhum outro aluno vê seus dados.",
        "O aluno vê do seu personal apenas nome, e-mail, telefone e foto — o suficiente para entrar em contato.",
        "Não vendemos, alugamos nem cedemos dados pessoais a terceiros.",
        "As imagens do catálogo de exercícios são carregadas pelo seu navegador diretamente do repositório público free-exercise-db (GitHub Pages), o que significa que esse serviço recebe a requisição do seu navegador. Nenhum dado seu é enviado nessa requisição além do que qualquer acesso a um site público expõe.",
        "[[Se e quando forem usados serviços de terceiros para hospedagem, envio de e-mail ou pagamento, eles precisam ser nomeados aqui, com a informação de se há transferência internacional de dados.]]",
      ],
    },
    {
      titulo: "5. Segurança",
      paragrafos: [
        "Senhas são guardadas com hash e nunca em texto claro — nem nós conseguimos lê-las. Links de convite e de redefinição de senha são de uso único, têm prazo de validade e também são guardados com hash.",
        "O acesso a dados é isolado por conta de personal, verificado a cada requisição no servidor e não apenas escondido na tela.",
        "Nenhum sistema é imune a incidentes. Se ocorrer um incidente de segurança relevante, comunicaremos os titulares afetados e a ANPD, conforme o art. 48 da LGPD.",
      ],
    },
    {
      titulo: "6. Por quanto tempo guardamos",
      paragrafos: [
        "Enquanto sua conta existir. Registros de execução e avaliações são histórico: eles sobrevivem à remoção de um treino ou de uma dieta, porque descrevem o que aconteceu e não o que está prescrito.",
        "Desativar um aluno não apaga os dados dele — impede o acesso e preserva o histórico para o personal. A exclusão definitiva é feita mediante pedido, ressalvados os registros que a lei obrigue a manter.",
      ],
    },
    {
      titulo: "7. Seus direitos",
      paragrafos: [
        "A LGPD (art. 18) garante a você: confirmar se tratamos seus dados; acessá-los; corrigir dados incompletos ou desatualizados; pedir anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade; pedir a portabilidade; saber com quem compartilhamos; revogar o consentimento; e se opor a um tratamento.",
        "Boa parte disso você já faz sozinho na plataforma: consultar e corrigir seus dados em \"Minha conta\", e ver seu histórico completo em \"Minha evolução\".",
        `Para os demais pedidos, escreva para ${EMPRESA.email}. Se você é aluno, o pedido pode ser feito também ao seu personal, que é o controlador dos seus dados.`,
      ],
    },
    {
      titulo: "8. Onde os dados ficam no seu dispositivo",
      paragrafos: [
        "Guardamos no armazenamento local do seu navegador apenas o token da sua sessão e a preferência de tema (claro ou escuro). Não usamos cookies de rastreamento nem ferramentas de publicidade.",
      ],
    },
    {
      titulo: "9. Mudanças nesta política",
      paragrafos: [
        `Podemos atualizar esta política. Quando a mudança for relevante, publicamos a nova versão com data e pedimos novo aceite. A versão vigente é ${VERSAO}, em vigor desde ${VIGENTE_DESDE}.`,
      ],
    },
  ],
};

export const DOCUMENTOS = { termos: TERMOS, privacidade: PRIVACIDADE };
