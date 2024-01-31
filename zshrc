export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="fino"

plugins=(git)

source $ZSH/oh-my-zsh.sh

HISTFILE=~/.histfile
HISTSIZE=10000
SAVEHIST=10000
setopt autocd
bindkey -e

autoload -U select-word-style
select-word-style bash

[[ -f "$HOME/.zshrc_local" ]] && source "$HOME/.zshrc_local"
[[ -f "$HOME/.elan/env" ]] && source "$HOME/.elan/env"

