# Balão — leitor de quadrinhos

Biblioteca e leitor privado para **CBR, CBZ, ZIP, PDF, JPG, PNG, WEBP e AVIF**. Os arquivos escolhidos são processados no próprio navegador e não são enviados para nenhum servidor.

## Publicar no GitHub Pages

1. Crie um repositório novo no GitHub.
2. Extraia este pacote e envie **todos os arquivos e pastas** para a raiz do repositório. O `index.html` precisa ficar na raiz.
3. No repositório, abra **Settings → Pages**.
4. Em **Build and deployment**, selecione **Deploy from a branch**.
5. Escolha a branch `main`, a pasta `/ (root)` e clique em **Save**.
6. Aguarde o endereço do site aparecer na mesma tela.

Se estiver substituindo uma versão anterior, envie todos os arquivos novamente. Depois da publicação, feche e abra o site uma vez para o navegador trocar o cache offline antigo pela versão nova.

Não é necessário configurar banco de dados, servidor, chave de API ou variável de ambiente.

## Principais controles

- **Biblioteca local:** ao importar uma HQ, o site identifica o nome, gera a capa e salva ficha, arquivo e progresso no banco local do navegador quando há espaço disponível.
- **Descobrir:** pesquisa edições e sinopses usando Google Books e Open Library. O catálogo serve para informação e organização; a leitura continua exigindo um arquivo do usuário.
- **Quero ler:** salva uma ficha sem o arquivo para lembrar depois.
- **Vinculação direta:** arraste CBR, CBZ ou PDF sobre uma ficha da biblioteca ou do catálogo para associar o arquivo à edição.
- **Modo Falas por toque:** mantém a página inteira visível; toque no balão de fala desejado e somente ele cresce perto da posição original. Toque no balão ampliado para seguir a ordem ocidental ou mangá.
- **Sem onomatopeias automáticas:** o reconhecimento procura balões de fala fechados e ignora letras soltas da arte. Para formatos incomuns, use a seleção manual.
- **Escolher área:** permite marcar manualmente uma fala quando o desenho não possui um balão tradicional.
- **F:** ativa ou encerra o Modo Falas.
- **Setas:** mudam de página conforme a direção escolhida.
- **+ / − / 0:** altera ou restaura o zoom.
- **Página única, dupla e rolagem vertical.**
- **Celular:** layout adaptado às áreas seguras da tela, miniaturas isoladas da barra inferior, controles completos de zoom, rotação e tela cheia, além de rolagem contínua sem saltos de página.
- **Brilho, contraste, rotação, largura, página inteira e tela cheia.**
- **Banco local:** guarda fichas, progresso, preferências e, quando o navegador permite, o próprio arquivo da HQ somente neste aparelho.

## Observações

- CBR e CBZ protegidos por senha, divididos em várias partes ou danificados podem não abrir.
- Arquivos muito grandes dependem da memória disponível no aparelho.
- A biblioteca é específica deste navegador e deste aparelho. Limpar os dados do site também remove fichas e arquivos guardados localmente.
- Se o navegador não tiver espaço suficiente para guardar uma HQ grande, ela continuará disponível durante a sessão atual e poderá ser vinculada novamente depois.
- A busca do Google Books funciona melhor com uma chave de API restrita ao domínio do GitHub Pages. Sem chave, o leitor tenta o acesso público disponível e usa a Open Library como alternativa.
- O Modo Falas funciona melhor com balões claros e texto escuro. Para caixas narrativas coloridas ou páginas muito estilizadas, use **Escolher área**.
- Após a primeira visita, o aplicativo pode funcionar offline graças ao cache do navegador.

Use apenas quadrinhos e documentos que você tenha autorização para ler.
