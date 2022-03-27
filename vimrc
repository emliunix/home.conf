call plug#begin('~/.vim/plugged')

Plug 'sonph/onehalf', { 'rtp': 'vim' }
Plug 'vim-airline/vim-airline'

call plug#end()
if has("termguicolors")
	set termguicolors
	let &t_8f = "\<Esc>[38:2:%lu:%lu:%lum"
	let &t_8b = "\<Esc>[48:2:%lu:%lu:%lum"
endif

syntax on
set cursorline
colorscheme onehalfdark
let g:airline_theme='onehalflight'
set expandtab
set shiftwidth=4
set tabstop=4
