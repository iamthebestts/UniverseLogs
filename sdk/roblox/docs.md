# UniverseLogs — Roblox Client

> Cliente de logging de nível corporativo (Enterprise-grade) para Roblox. Assíncrono, bufferizado, resiliente a falhas e altamente observável.

---

## Índice

- [Instalação](#instalação)
- [Início Rápido](#início-rápido)
- [Inicialização (Construtor)](#inicialização-constructor)
- [Referência de Configuração](#referência-de-configuração)
- [Métodos da API](#métodos-da-api)
  - [Core](#core)
  - [Atalhos de Nível (Shorthands)](#atalhos-de-nível-shorthands)
  - [Leitura e Gerenciamento](#leitura-e-gerenciamento)
- [Sistemas Internos](#sistemas-internos)
  - [Como o Buffer Funciona](#como-o-buffer-funciona)
  - [Fallback com DataStore](#fallback-com-datastore)
  - [Sistema de Throttling (Anti-Spam)](#sistema-de-throttling-anti-spam)
  - [Sanitização de Metadados](#sanitização-de-metadados)
- [Casos de Uso Avançados](#casos-de-uso-avançados)
- [Limites do Servidor (Rate Limits)](#limites-do-servidor-rate-limits)

---

## Instalação

1. Cole o módulo (ModuleScript) dentro de `ServerStorage` (ou `ReplicatedStorage` se preferir) e renomeie-o para `UniverseLogs`.
2. Nas configurações do seu jogo, habilite as requisições HTTP (`Game Settings → Security → Allow HTTP Requests`).
3. Caso vá utilizar o sistema de segurança contra perda de dados (DataStore Fallback), certifique-se de habilitar também o acesso à DataStore API.

---

## Início Rápido

O exemplo abaixo mostra como iniciar o módulo e enviar o seu primeiro log de inicialização do servidor.

```lua
local ServerStorage = game:GetService("ServerStorage")
local UniverseLogs = require(ServerStorage.UniverseLogs)

-- 1. Instanciar o cliente
local ul = UniverseLogs.new("sua-api-key-aqui", {
    baseUrl = "https://sua-api.com",
    autoReportErrors = true,
})

-- 2. Inicializar (Obrigatório)
local ok, err = ul:init()
if not ok then
    warn("[UniverseLogs] Falha ao inicializar:", err)
    return
end

-- 3. Enviar um log
ul:info("Servidor do jogo online e pronto!", {
    topic = "boot",
    metadata = { 
        placeId = game.PlaceId, 
        jobId = game.JobId 
    }
})
```

---

## Inicialização (Constructor)

```lua
UniverseLogs.new(apiKey: string, options?: Config): UniverseLogsInstance
```

Cria uma nova instância do cliente UniverseLogs.

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `apiKey` | `string` | **Obrigatório.** A chave de API gerada para o seu Universo. |
| `options` | `Config?` | Opcional. Uma tabela com as configurações detalhadas abaixo. |

### Referência de Configuração

Todas as opções são opcionais e possuem valores padrão otimizados.

| Opção | Tipo | Padrão | Descrição |
|---|---|---|---|
| `baseUrl` | `string` | `"https://api.universelogs.com"` | URL base da sua API do UniverseLogs. |
| `localBufferCapacity` | `number` | `1000` | Limite máximo de logs armazenados na memória antes de forçar o envio ao servidor. |
| `autoFlush` | `boolean` | `true` | Se `true`, acumula logs em lotes (batching). Se `false`, envia requisições HTTP a cada chamada. |
| `flushInterval` | `number` | `5000` | Intervalo em milissegundos (ms) para esvaziar o buffer automaticamente. |
| `throttleWindow` | `number` | `5` | Tempo de recarga (segundos) para evitar spam de um mesmo log (nível + mensagem). |
| `maxRetries` | `number` | `3` | Limite de tentativas ao falhar requisições HTTP (usa backoff exponencial). |
| `useDataStoreFallback` | `boolean` | `true` | Se a API cair, salva os logs no DataStore do Roblox para enviar depois. |
| `fallbackInterval` | `number` | `300` | Segundos entre as tentativas de reenviar a fila salva no DataStore. |
| `fallbackTTL` | `number` | `3600` | Segundos até um log antigo preso no DataStore ser considerado morto e deletado. |
| `fallbackMaxQueue` | `number` | `1000` | Limite de logs acumulados no DataStore. |
| `autoReportErrors` | `boolean` | `false` | Se `true`, captura automaticamente qualquer erro de script (`ScriptContext.Error`) e envia como nível `error`. |
| `errorFilter` | `function?` | `nil` | Função `(message, stackTrace, script) -> boolean` para filtrar quais erros reportar. |
| `maxBulkSize` | `number` | `500` | Limite de logs agrupados em uma única requisição POST. |
| `maxThrottleEntries` | `number` | `5000` | Limite do cache de chaves para o filtro anti-spam. |

---

## Métodos da API

### Core

#### `ul:init()`
```lua
ul:init(): (boolean, string?)
```
Inicializa os serviços em background do cliente. **Deve ser chamado obrigatoriamente antes de logar.**
* Executa o *health check* da API.
* Inicia o loop de recuperação do DataStore (se ativado).
* Inicia a limpeza do cache anti-spam.
* Prepara o `game:BindToClose` para garantir o envio dos logs quando o servidor do Roblox fechar.

Retorna `true, nil` em caso de sucesso, ou `false, "Mensagem de erro"`.

#### `ul:destroy()`
```lua
ul:destroy()
```
Encerra os loops em background e envia (faz flush) de forma síncrona qualquer log que ainda esteja preso na memória.

#### `ul:log()`
```lua
ul:log(level: LogLevel, message: string, options?: LogOptions)
```
O método principal. Valida, sanitiza, aplica o anti-spam e enfileira o log.

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `level` | `string` | Severidade: `'trace' \| 'debug' \| 'info' \| 'warn' \| 'error' \| 'fatal'` |
| `message` | `string` | A mensagem do log. Máximo **2048 caracteres**. |
| `options.topic` | `string?` | Tag para categorizar o log (ex: "economia", "anti-cheat"). Máximo **100 caracteres**. |
| `options.metadata` | `any?` | Tabela ou valor solto contendo dados adicionais úteis. [Sanitizado automaticamente](#sanitização-de-metadados). |
| `options.throttleKey` | `string?` | Chave customizada para o anti-spam. O padrão é `"{level}:{message}"`. |

### Atalhos de Nível (Shorthands)

Métodos práticos que chamam o `ul:log()` com o nível predefinido. Todos aceitam `(message: string, options?: LogOptions)`.

```lua
-- Fluxos super detalhados e rastreio de código
ul:trace("Loop do minigame iniciado")

-- Informações de desenvolvimento
ul:debug("Gerando mapa com seed", { metadata = { seed = 12345 } })

-- Eventos operacionais normais
ul:info("Jogador comprou um item na loja", { topic = "economia" })

-- Avisos que não quebram o jogo, mas precisam de atenção
ul:warn("Uso alto de memória detectado", { topic = "performance" })

-- Erros capturados em pcalls ou falhas sistêmicas
ul:error("Falha ao salvar inventário do jogador", { topic = "datastore" })

-- Quebra crítica do jogo
ul:fatal("Banco de dados principal offline. Derrubando jogadores.", { topic = "core" })
```

### Leitura e Gerenciamento

#### `ul:getLogs()`
```lua
ul:getLogs(filters?: QueryFilters): (boolean, { logs: LogEntry[], nextCursor: Cursor? }?)
```
Busca logs diretamente do seu servidor com filtros e paginação nativa por cursor.

```lua
-- Exemplo: Pegar os últimos 50 avisos do Anti-Cheat
local ok, result = ul:getLogs({ level = "warn", topic = "anticheat", limit = 50 })

if ok and result then
    for _, log in ipairs(result.logs) do
        print(string.format("[%s] %s", log.timestamp, log.message))
    end
end
```

**Filtros disponíveis:**
* `level` (string)
* `topic` (string)
* `limit` (number, padrão 20, máximo 100)
* `from` / `to` (string em formato ISO 8601)
* `cursor_ts` / `cursor_id` (para paginação)

#### `ul:getLogsCount()`
```lua
ul:getLogsCount(filters?: { from: string?, to: string? }): (boolean, LogsCount?)
```
Puxa o número total de logs e a quantidade exata por cada nível.

#### `ul:getLogById()`
```lua
ul:getLogById(id: string): (boolean, LogEntry?)
```
Busca um registro específico usando o seu ID único.

#### `ul:deleteLogs()`
```lua
ul:deleteLogs(params: { olderThan: string, level: string?, topic: string? }): (boolean, { deleted: number }?)
```
Apaga permanentemente logs mais antigos que a data (`olderThan` em ISO 8601) fornecida. Opcionalmente filtrado por `level` ou `topic`.

---

## Sistemas Internos

### Como o Buffer Funciona

O cliente NUNCA faz uma requisição HTTP solta a menos que você desative o `autoFlush`. Os logs são retidos na memória (Buffer) e enviados em um arrastão (Bulk):

`ul:log() → [Buffer na Memória] → (gatilho de disparo) → POST /api/logs/bulk → API do UniverseLogs`

**A remessa em lote (flush) ocorre nestes cenários:**
1. O timer do `flushInterval` atinge 0 (A cada 5 segundos por padrão).
2. O limite de `localBufferCapacity` é atingido (Força envio imediato para evitar estourar a memória).
3. O servidor desliga (`game:BindToClose`). O código ganha 5 segundos para limpar a fila.
4. Você chama o `ul:destroy()`.

### Fallback com DataStore

Se a sua API estiver fora do ar ou o Roblox falhar as requisições HTTP (`HttpService`), os logs não são perdidos.

1. Se a requisição HTTP falhar, a fila vai parar na DataStore `UniverseLogs_Fallback_v1`.
2. Um sistema em background tenta reenviar essa fila a cada `fallbackInterval` (5 minutos).
3. Um bloqueio distribuído (Distributed Lock) na DataStore `UniverseLogs_Lock_v1` garante que **apenas um servidor do jogo** tente processar essa fila por vez, impedindo envios duplicados.
4. Logs parados lá há muito tempo (passou do `fallbackTTL` - 1 hora) são deletados para evitar lixo.

### Sistema de Throttling (Anti-Spam)

Sistemas em loop podem gerar mil logs iguais por acidente. O UniverseLogs bloqueia isso nativamente.
* Por padrão, a exata mesma `mensagem` do mesmo `nível` só é enviada **1 vez a cada 5 segundos** (`throttleWindow`).
* Os excedentes são **silenciosamente descartados** no cliente, poupando rede e banco de dados.

**Customizando o Anti-Spam:**
Se quiser limitar o envio de mensagens idênticas **por jogador** ao invés de globalmente, passe uma `throttleKey` única:

```lua
ul:warn("Comportamento suspeito (SpeedHack)", {
    throttleKey = "speedhack_" .. player.UserId, -- Limita a 1 por jogador a cada 5s
    metadata = { userId = player.UserId }
})
```

### Sanitização de Metadados

Tabelas em Luau podem ser brutais (Instâncias recursivas, metatables infinitas). O UniverseLogs processa e traduz seu `metadata` de forma segura:

| Tipo do Roblox | O que vai para o Banco de Dados |
|---|---|
| `Vector3` | `"Vector3(1.00, 2.00, 3.00)"` |
| `CFrame` | `"CFrame(x, y, z)"` *(Posição)* |
| `Color3` | `"Color3(R=1.00, G=0.00, B=0.00)"` |
| `Instance (Player)` | `"Player(NomeDoCara, UserId=123)"` |
| `Instance (Base)` | `"Part("Porta")"` |
| Tabelas Gigantes | Truncadas após 64 chaves |
| Referência Circular | `"[Circular Reference]"` |

Você não precisa dar `JSONEncode` ou se preocupar com ciclos. Apenas passe a tabela pura no `metadata`.

---

## Casos de Uso Avançados

### Captura Automática de Erros com Filtro
Excelente para centralizar painéis de Crash sem lotar de erros irrelevantes.

```lua
local ul = UniverseLogs.new("KEY", {
    autoReportErrors = true,
    errorFilter = function(message, stackTrace, script)
        -- Exemplo: Ignorar erros de bibliotecas de UI de terceiros
        if script and script.Name == "Roact" then
            return false
        end
        return true
    end,
})
```

### Registrando Entradas e Saídas do Servidor
O uso da `throttleKey` aqui previne spam se um jogador usar exploit para dar Join/Leave repetidamente muito rápido.

```lua
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
    ul:info("Player joined the game", {
        topic = "players",
        throttleKey = "join:" .. player.UserId,
        metadata = {
            userId = player.UserId,
            accountAge = player.AccountAge
        }
    })
end)
```

---

## Limites do Servidor (Rate Limits)

Para proteger a infraestrutura e o PostgreSQL, a API (Backend) possui *Rate Limits* estritos. Se o limite for quebrado, a API retorna `HTTP 429 Too Many Requests`.

| Operação (Endpoint) | Limite por minuto |
|---|---|
| Criação em Lote (`POST /api/logs/bulk`) | 20 chamadas |
| Criação Solta (`POST /api/logs`) | 100 chamadas |
| Leitura Lista (`GET /api/logs`) | 120 chamadas |
| Contagem (`GET /api/logs/count`) | 120 chamadas |
| Leitura Única (`GET /api/logs/:id`) | 60 chamadas |
| Deletar (`DELETE /api/logs`) | 30 chamadas |

**Limitações de Tamanho do Log (Enforced na API e no Cliente):**
* **Tópico:** Máximo 100 caracteres.
* **Mensagem:** Máximo 2048 caracteres.
* **Bulk Size:** O Cliente divide automaticamente lotes de envio maiores que `500` arquivos (Editável no `maxBulkSize`).

---

## ⚠️ Aviso de Segurança e Responsabilidade

### USO EXCLUSIVO NO SERVIDOR (ServerScriptService/ServerStorage)

**NUNCA** coloque este módulo em locais acessíveis ao cliente (`ReplicatedStorage`, `ReplicatedFirst`, `StarterPlayer`, etc.). O módulo contém sua **API Key** em texto puro e possui acesso direto aos endpoints de escrita, leitura e exclusão de logs.

### Responsabilidades do Desenvolvedor

Ao utilizar este módulo, você reconhece e concorda que:

1. **Proteção de Credenciais**: Você é responsável por manter suas chaves (`API Key` e `MASTER_KEY`) em sigilo absoluto. Não as exponha em scripts do cliente, não as commite em repositórios públicos do GitHub, e não as compartilhe com terceiros não autorizados.

2. **Isolamento do Cliente**: O módulo deve ser utilizado **exclusivamente em ServerScripts**. Se um exploit conseguir acesso às suas credenciais através de má configuração (ex: ModuleScript em `ReplicatedStorage`), um atacante pode:
   - Inundar seu banco de dados com logs falsos/spam, estourando custos de armazenamento.
   - Deletar todo o histórico de logs do seu universo através do endpoint `deleteLogs()`.
   - Consultar logs sensíveis contendo informações privadas de jogadores ou do sistema.

3. **Conformidade com Políticas**: Você é responsável por garantir que os dados coletados através deste sistema estejam em conformidade com as políticas da Roblox, LGPD (Brasil), GDPR (Europa), COPPA (EUA) e demais regulamentações aplicáveis. Não registre informações pessoais identificáveis (PII) sem o devido consentimento e proteção.

4. **Monitoramento de Custos**: Logs em alto volume podem gerar custos significativos de armazenamento, processamento e tráfego de rede. Configure políticas de retenção adequadas (`deleteLogs`) e monitore o uso regularmente.

5. **Testes em Ambiente Controlado**: Sempre teste as integrações em ambientes de desenvolvimento/homologação antes de publicar em produção. Rate limits, falhas de rede e comportamentos inesperados devem ser tratados adequadamente.

### Isenção de Responsabilidade

O autor deste software (`iamthebestts`) e quaisquer contribuidores **NÃO SE RESPONSABILIZAM** por:
- Perda, vazamento ou corrupção de dados.
- Danos financeiros decorrentes de uso indevido, má configuração ou ataques.
- Violação de políticas da Roblox, leis de proteção de dados ou regulamentações locais.
- Indisponibilidade, bugs ou comportamentos inesperados do software.

**Este software é fornecido "COMO ESTÁ" (AS IS), sem garantias de qualquer tipo, expressas ou implícitas, incluindo, mas não se limitando a, garantias de comercialização, adequação a um propósito específico e não violação.**

Ao utilizar este módulo, você assume total responsabilidade pelos riscos associados.

---

## 📜 Licença MIT

Copyright © 2026 iamthebestts

A licença completa pode ser encontrada no arquivo `LICENSE` do repositório.

---

<div align="center">
  <p>Desenvolvido com ❤️ por <a href="https://github.com/iamthebestts">iamthebestts</a></p>
  <p><strong>Use com responsabilidade. Proteja suas credenciais. Mantenha seguro.</strong></p>
</div>
