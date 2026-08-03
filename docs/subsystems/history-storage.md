# Subsystem: History & Storage

> Parent: [Design Overview](/docs/DESIGN.md)

---

## 1. Responsibility

Persist conversations, media attachments, learning memory, and engagement across page reloads and devices.

---

## 2. Storage Architecture

```mermaid
flowchart TB
    subgraph Client["Browser Storage"]
        LS["localStorage\nspark.sessions\nspark.learningMemory\nspark.engagement\nspark.studentProfile.v2\nspark.voiceId"]
        IDB["IndexedDB\nspark.photoVault"]
    end

    subgraph Server["Server Storage"]
        FS["data/conversations/\n{sessionId}.json"]
        LM_FILE["data/learning-memory.json"]
        MEDIA["data/media/\n{mediaId}.{ext}"]
    end

    subgraph API["Sync API"]
        HIST["/api/history · CRUD"]
        LEARN["/api/learning · GET/PUT"]
        MEDIA_API["/api/media/{mediaId}"]
    end

    LS <-->|"GET/PUT/DELETE"| HIST
    LS <-->|"GET/PUT"| LEARN
    IDB <-->|"upload / fetch"| MEDIA_API
    HIST --> FS
    LEARN --> LM_FILE
    MEDIA_API --> MEDIA
```

---

## 3. Conversation Lifecycle

```mermaid
sequenceDiagram
    participant User
    participant LS as localStorage
    participant API as /api/history
    participant FS as data/conversations/

    User->>LS: loadConversations()
    LS-->>User: [{ sessionId, messages[], title }]

    User->>API: GET /api/history (hydrate)
    API->>FS: read all conversations
    FS-->>API: [...]
    API-->>LS: merge into local

    loop each turn
        User->>LS: saveConversations()
        User->>API: PUT /api/history
        API->>FS: saveConversation()
    end

    User->>API: DELETE /api/history?sessionId=X
    API->>FS: unlink conversation file
```

---

## 4. Retention Policy

```mermaid
flowchart TD
    WRITE["New message saved"]
    CHECK1{"totalMessages > 1000?"}
    TRIM_OLDEST["Delete oldest message\nacross all conversations"]
    CHECK2{"conversations > 100?"}
    TRIM_EMPTY["Delete emptiest conversation"]

    WRITE --> CHECK1
    CHECK1 -->|"yes"| TRIM_OLDEST
    CHECK1 -->|"no"| OK["Keep"]
    TRIM_OLDEST --> CHECK2
    CHECK2 -->|"yes"| TRIM_EMPTY
    CHECK2 -->|"no"| OK
```

| Limit | Value |
|-------|-------|
| Max messages total | 1000 |
| Max conversations | 100 |
| Max messages per chat | 200 |
| Max message chars in history prompt | 500 |
| Max history turns in prompt | 8 |

---

## 5. Photo Vault

```mermaid
flowchart LR
    UPLOAD["User attaches photo/PDF"]
    LS["localStorage · dataUrl"]
    IDB["IndexedDB · photo vault"]
    API["POST /api/chat\n{ attachments: [{ data, mimeType }] }"]
    SAVE["Server saves blob\ndata/media/{mediaId}.{ext}"]
    STRIP["Storage sanitize\nRemove base64 from JSON\nKeep mediaId only"]

    UPLOAD --> LS
    LS --> IDB
    UPLOAD --> API
    API --> SAVE
    SAVE --> STRIP
```

Photos survive server JSON round-trips: the raw base64 is stripped for wire transfer but restored from the IndexedDB vault on load.

---

## 6. Memory Sync

```mermaid
sequenceDiagram
    participant Client as Browser
    participant Server as /api/learning
    participant FS as data/learning-memory.json

    Note over Client: hydrateLearningMemoryFromServer()
    Client->>Server: GET /api/learning
    Server->>FS: read
    FS-->>Server: { topics, skills, … }
    Server-->>Client: { memory }
    Client->>Client: mergeLearningMemory(local, remote)
    Client->>Client: saveLearningMemory(merged)

    Note over Client: After each chat turn
    Client->>Client: recordLearningTurnMemory()
    Client->>Server: PUT /api/learning { memory }
    Server->>FS: write
    FS-->>Server: ok
    Server-->>Client: { ok: true }
```

---

## 7. Media Blob Store

```mermaid
flowchart LR
    ATTACH["User attaches image / PDF"]
    UPLOAD["POST /api/chat\n{ attachments: [ … ] }"]
    EXTRACT["Extract attachments\nSave to data/media/"]
    RESPOND["Respond with mediaId in stream"]
    FETCH["GET /api/media/{mediaId}"]
    SERVE["Serve blob with Content-Type"]

    ATTACH --> UPLOAD --> EXTRACT --> RESPOND
    RESPOND --> FETCH --> SERVE
```

---

## 8. Sanitization for Server Sync

`serializeForServer()` strips:

- Base64 data URLs from attachments (keeps `mediaId`)
- BKT `pKnown` is rounded to 3 decimal places
- Topic labels truncated to 48 chars
- Skill labels truncated to 56 chars
- Notes truncated to 4 items per list

---

## 9. Edge Cases

| Case | Handling |
|------|----------|
| localStorage quota exceeded | `catch` + ignore; oldest conversations trimmed |
| Server offline | Local-only; sync on next hydrate |
| IndexedDB unavailable | Photo only in memory (lost on reload) |
| Corrupted JSON | `emptyLearningMemory()` / `emptyConversation()` |
| Merged server+client | `mergeLearningMemory` keeps max mastery/attempts/lastSeen |
| New device (empty client) | Hydrate from server; start fresh if server also empty |

---

## Next: [Security & Sanitization](security.md)
