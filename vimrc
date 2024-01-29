call plug#begin('~/.vim/plugged')

Plug 'sonph/onehalf', { 'rtp': 'vim' }
Plug 'vim-airline/vim-airline'
Plug 'Shougo/vimproc.vim', { 'do': 'make' }
Plug 'Shougo/vimshell.vim'
Plug 'idris-hackers/idris-vim'

call plug#end()

if exists('+termguicolors')
  let &t_8f = "\<Esc>[38;2;%lu;%lu;%lum"
  let &t_8b = "\<Esc>[48;2;%lu;%lu;%lum"
  set termguicolors
endif

syntax on
set t_Co=256
set cursorline
colorscheme onehalfdark
let g:airline_theme='onehalflight'
" lightline
" let g:lightline = { 'colorscheme': 'onehalfdark' }
set expandtab
set shiftwidth=4
set tabstop=4

set listchars=tab:▷▷⋮
set invlist
