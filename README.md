# Sistema de Controle de Rondas para Segurança

Um sistema de gerenciamento de rondas de segurança com aplicativo móvel para guardas e painel administrativo para supervisores.

## Funcionalidades

- Autenticação de usuários (guardas e administradores)
- Escaneamento de QR codes para verificação de pontos
- Registro de check-ins com validação de geolocalização
- Funcionamento offline com sincronização posterior
- Painel administrativo para gerenciamento de usuários e pontos
- Geração de QR codes para pontos de verificação
- Relatórios detalhados e exportação para CSV/PDF

## Stack Tecnológica

### Frontend
- React com TypeScript
- Vite como bundler
- Tailwind CSS para estilos
- PWA para funcionamento offline e instalação
- React Router para navegação
- Tanstack Table para tabelas
- Leaflet para mapas
- Recharts para gráficos

### Backend
- Node.js com Express.js
- LibSQL (SQLite) para banco de dados
- JWT para autenticação
- QR Code para geração e leitura de códigos
- Criptografia AES para segurança dos QR codes

## Como iniciar

### Requisitos
- Node.js 18+
- NPM ou Yarn

### Instalação e execução

1. Clone o repositório:
```bash
git clone [URL_DO_REPOSITORIO]
cd sistema-rondas
```

2. Instale as dependências:
```bash
# Frontend
npm install

# Backend
cd server
npm install
cd ..
```

3. Inicie o backend:
```bash
npm run server
```

4. Em outro terminal, inicie o frontend:
```bash
npm run dev
```

5. Acesse o aplicativo:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Credenciais padrão

**Administrador:**
- Email: admin@secrondas.com
- Senha: admin123

**Guarda:**
- Email: guarda@secrondas.com
- Senha: guarda123

## Implantação em Ambiente de Produção

Para implantação em rede local:

1. Construa o frontend:
```bash
npm run build
```

2. Configure o arquivo `.env` com suas próprias chaves secretas.

3. Configure o caminho do banco de dados no arquivo `.env` para um local na rede compartilhada:
```
DB_PATH=/caminho/rede/local/database.sqlite
```

4. Inicie o servidor:
```bash
node server/index.js
```

5. Sirva os arquivos estáticos do frontend:
```bash
npm run preview -- --host 0.0.0.0 --port 5173
```

6. Distribua o link para os guardas acessarem em seus dispositivos móveis.

## Documentação da API

A API conta com os seguintes endpoints principais:

- `/api/login` - Autenticação de usuários
- `/api/checkin` - Registro de verificação de ponto
- `/api/guard/*` - Endpoints para guardas
- `/api/admin/*` - Endpoints para administradores
- `/api/user/profile` - Gerenciamento de perfil

Consulte o código fonte para mais detalhes sobre os endpoints disponíveis.

## Estrutura do Projeto

- `/public` - Arquivos estáticos e ícones
- `/src` - Código fonte do frontend
  - `/contexts` - Contextos React
  - `/layouts` - Componentes de layout
  - `/pages` - Páginas da aplicação
  - `/services` - Serviços de API
- `/server` - Código fonte do backend# secronda
