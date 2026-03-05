# Política de Segurança e Responsabilidade

## 🔒 Visão Geral

O **UniverseLogs** é uma ferramenta poderosa de observabilidade que, se mal configurada, pode expor dados sensíveis ou permitir ataques ao seu sistema de logs. Este documento estabelece diretrizes de segurança obrigatórias e esclarece as responsabilidades do usuário final.

---

## ⚠️ AVISO CRÍTICO: USO EXCLUSIVO EM SERVER-SIDE SCRIPTS

### ❌ NUNCA faça isso

```lua
-- ❌ ERRADO: Instanciar o módulo em um LocalScript (Client-side)
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UniverseLogs = require(ReplicatedStorage.UniverseLogs)

-- Isso expõe sua API Key diretamente ao cliente!
local ul = UniverseLogs.new("sua-api-key-secreta", {...})
```

### ✅ SEMPRE faça isso

```lua
-- ✅ CORRETO: Instanciar apenas em Scripts do Servidor (Server-side)
local ServerStorage = game:GetService("ServerStorage")
local UniverseLogs = require(ServerStorage.UniverseLogs)

local ul = UniverseLogs.new("sua-api-key-secreta", {...})
```

**Por quê?** O módulo contém sua **API Key em texto puro** no código que instancia o cliente. Se você chamar `UniverseLogs.new()` de um **LocalScript** (client-side):

1. **A API Key fica visível para exploiters** através de decompiladores e ferramentas de injeção de script.
2. Um atacante pode extrair a chave e usá-la fora do jogo para:
   - **Inundar seu banco de dados** com milhões de logs falsos, estourando custos de armazenamento e processamento.
   - **Deletar todo o histórico** através do método `deleteLogs()`.
   - **Extrair informações confidenciais** de logs contendo dados de jogadores, economia do jogo ou lógica de anti-cheat.

### ⚠️ Esclarecimento Importante

**A localização física do ModuleScript não importa** (`ServerStorage`, `ReplicatedStorage`, etc.). O que importa é **de onde você chama `UniverseLogs.new()` com a API Key**:

- ✅ **Seguro**: Chamar de um `Script` (server-side) em qualquer lugar (`ServerScriptService`, `Workspace`, etc.)
- ❌ **INSEGURO**: Chamar de um `LocalScript` (client-side) em qualquer lugar (`StarterPlayer`, `StarterGui`, `ReplicatedFirst`, etc.)

**Regra de Ouro:** A API Key **NUNCA** deve existir ou ser processada no cliente. Sempre mantenha a instanciação do módulo no servidor.

---

## 🔑 Proteção de Credenciais

### API Keys e Master Keys

As chaves de acesso são as "senhas" do seu sistema de logs. **Nunca:**

- ❌ Faça commit de arquivos `.env` ou chaves hardcoded em repositórios públicos.
- ❌ Compartilhe suas chaves em Discord, fóruns ou tickets de suporte.
- ❌ Reutilize chaves entre ambientes de desenvolvimento e produção.
- ❌ Armazene chaves em plain text em arquivos de configuração versionados.
- ❌ **Instancie o módulo com a API Key em LocalScripts (client-side).**

### Boas Práticas

- ✅ Use variáveis de ambiente (`.env`) e adicione `.env` ao `.gitignore`.
- ✅ Rotacione chaves comprometidas imediatamente através do endpoint `/internal/keys/revoke`.
- ✅ Crie chaves separadas para desenvolvimento, homologação e produção.
- ✅ Implemente monitoramento de uso anômalo (ex: picos repentinos de requisições).
- ✅ **Sempre instancie o módulo em Scripts do servidor (server-side).**

---

## 🛡️ Segurança dos Dados Coletados

### Conformidade Legal

Você é **legalmente responsável** por garantir que os dados coletados estejam em conformidade com:

- **LGPD** (Brasil): Lei Geral de Proteção de Dados Pessoais
- **GDPR** (União Europeia): General Data Protection Regulation
- **COPPA** (EUA): Children's Online Privacy Protection Act
- **Políticas da Roblox**: [Roblox Terms of Use](https://en.help.roblox.com/hc/en-us/articles/115004647846)

### O Que NÃO Logar

❌ **Dados Pessoais Identificáveis (PII) sem consentimento explícito:**

- Endereços IP completos
- Nomes reais de usuários
- E-mails, números de telefone
- Dados de localização geográfica precisa
- Informações financeiras (exceto IDs de transação genéricos)

### O Que Logar com Segurança

✅ **Dados anonimizados ou pseudonimizados:**

- `UserId` do Roblox (identificador de plataforma, não PII direto)
- Timestamps de eventos
- Ações de gameplay (ex: "item comprado", "nível concluído")
- Erros técnicos (stack traces sem informações sensíveis)

---

## 💰 Gestão de Custos e Recursos

### Monitoramento de Volume

Logs em alto volume podem gerar custos significativos:

- **Armazenamento**: PostgreSQL, backups, retenção de longo prazo.
- **Computação**: Processamento de batches, queries complexas.
- **Rede**: Tráfego HTTP entre Roblox e seu servidor.

### Recomendações

1. **Configure políticas de retenção automática:**

   ```lua
   -- Deletar logs com mais de 30 dias
   ul:deleteLogs({
       olderThan = os.date("!%Y-%m-%dT%H:%M:%SZ", os.time() - 30*24*60*60)
   })
   ```

2. **Use `topic` para categorizar e filtrar:**
   - Mantenha logs críticos (`topic = "security"`) por mais tempo.
   - Descarte logs de debug (`topic = "dev"`) rapidamente.

3. **Monitore métricas regularmente:**

   ```lua
   local ok, count = ul:getLogsCount()
   if ok and count.total > 1000000 then
       warn("⚠️ Logs exceeding 1M. Consider cleanup.")
   end
   ```

---

## 🚨 Reportar Vulnerabilidades

Se você descobrir uma vulnerabilidade de segurança neste projeto, **NÃO** crie uma Issue pública no GitHub.

### Processo de Divulgação Responsável

1. Envie um e-mail detalhado para: **<githubissues.tremor737@passinbox.com>** *(ou crie uma GitHub Security Advisory)*
2. Inclua:
   - Descrição da vulnerabilidade
   - Passos para reproduzir
   - Impacto potencial
   - Sugestão de correção (se possível)
3. Aguarde confirmação de recebimento em até 48h.
4. Aguarde a publicação do patch antes de divulgar publicamente.

---

## 📋 Responsabilidades do Desenvolvedor (Você)

Ao utilizar o UniverseLogs, você reconhece e concorda que é **100% responsável** por:

### 1. Configuração e Implantação

- Garantir que o módulo é instanciado **exclusivamente em server-side scripts**.
- Proteger credenciais contra vazamento.
- Configurar rate limits e throttling adequadamente.

### 2. Conformidade Legal

- Cumprir leis de proteção de dados aplicáveis (LGPD, GDPR, COPPA).
- Obter consentimento para coleta de dados quando necessário.
- Implementar políticas de privacidade transparentes.

### 3. Monitoramento e Manutenção

- Monitorar custos de armazenamento e tráfego.
- Implementar políticas de retenção de dados.
- Investigar e responder a incidentes de segurança.

### 4. Gestão de Riscos

- Realizar testes de segurança antes do deploy em produção.
- Implementar backups e planos de recuperação de desastres.
- Treinar equipe sobre boas práticas de segurança.

---

## 🚫 Isenção de Responsabilidade

### O autor (`iamthebestts`) e contribuidores NÃO SE RESPONSABILIZAM POR

- ❌ Perda, vazamento, corrupção ou roubo de dados.
- ❌ Danos financeiros (custos de armazenamento, multas regulatórias, etc.).
- ❌ Violação de políticas da Roblox ou leis de proteção de dados.
- ❌ Indisponibilidade, bugs, falhas de segurança ou comportamentos inesperados.
- ❌ Ataques cibernéticos resultantes de má configuração ou exposição de credenciais.
- ❌ Uso indevido por terceiros (exploiters, atacantes, concorrentes).

### Cláusula "AS IS" (Como Está)

Este software é distribuído **"COMO ESTÁ" (AS IS)**, sem garantias de qualquer tipo, expressas ou implícitas, incluindo, mas não se limitando a:

- Garantias de comercialização
- Adequação a um propósito específico
- Não violação de direitos de terceiros
- Segurança, confiabilidade ou precisão

**Você assume TODOS os riscos associados ao uso deste software.**

---

## ✅ Checklist de Segurança Pré-Deploy

Antes de colocar o UniverseLogs em produção, verifique:

- [ ] O módulo é instanciado **exclusivamente em Scripts do servidor** (nunca em LocalScripts).
- [ ] A `API Key` não está exposta ao cliente em nenhuma circunstância.
- [ ] A `MASTER_KEY` do backend possui pelo menos 32 caracteres aleatórios.
- [ ] Rate limits estão configurados no backend (`rateLimitHandler`).
- [ ] Políticas de retenção de dados estão ativas (ex: deletar logs > 90 dias).
- [ ] Logs não contêm PII não consentida (nomes reais, e-mails, IPs completos).
- [ ] Backups regulares do banco de dados PostgreSQL estão configurados.
- [ ] Monitoramento de custos e alertas de anomalias estão ativos.
- [ ] Testes de carga foram realizados para validar limites de throughput.
- [ ] Equipe foi treinada sobre boas práticas de segurança e compliance.

---

## 📞 Contato

Para questões de segurança críticas, **não use Issues públicas**. Entre em contato através de:

- **GitHub Security Advisory**: [Criar Advisory Privada](https://github.com/iamthebestts/UniverseLogs/security/advisories/new)
- **Discord da Nexo+**: [https://discord.gg/EPucmXpDQR](https://discord.gg/EPucmXpDQR) (canal `#atendimento`)

---

## 📜 Licença

Este documento faz parte do projeto **UniverseLogs** e está sujeito aos termos da [Licença MIT](../LICENSE).

**Use com sabedoria. Proteja suas credenciais. Mantenha seus usuários seguros.**

---

<div align="center">
  <p><strong>Segurança não é um recurso. É uma responsabilidade.</strong></p>
</div>
