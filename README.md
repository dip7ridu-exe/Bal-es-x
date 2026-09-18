# Balão — leitor de quadrinhos

Leitor estático e privado para **CBR, CBZ, ZIP, PDF, JPG, PNG, WEBP e AVIF**. Os arquivos escolhidos são processados no próprio navegador e não são enviados para nenhum servidor.

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

- **Modo Falas contextual:** mantém a página e a arte ao redor visíveis, aproxima cada balão e avança na ordem ocidental ou mangá.
- **Escolher área:** permite marcar manualmente uma fala quando o desenho não possui um balão tradicional.
- **F:** abre ou avança o Modo Falas.
- **Setas:** mudam de página conforme a direção escolhida.
- **+ / − / 0:** altera ou restaura o zoom.
- **Página única, dupla e rolagem vertical.**
- **Celular:** layout adaptado às áreas seguras da tela, gestos estáveis e rolagem contínua sem saltos de página.
- **Brilho, contraste, rotação, largura, página inteira e tela cheia.**
- **Histórico local:** guarda apenas nome, progresso e preferências neste navegador. O arquivo do quadrinho não é armazenado.

## Observações

- CBR e CBZ protegidos por senha, divididos em várias partes ou danificados podem não abrir.
- Arquivos muito grandes dependem da memória disponível no aparelho.
- O Modo Falas funciona melhor com balões claros e texto escuro. Para caixas narrativas coloridas ou páginas muito estilizadas, use **Escolher área**.
- Após a primeira visita, o aplicativo pode funcionar offline graças ao cache do navegador.

Use apenas quadrinhos e documentos que você tenha autorização para ler.
