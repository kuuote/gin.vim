function! gin#component#status#staged() abort
  let component = 'component:status:staged'
  call gin#internal#component#init(component)
  return gin#internal#component#get(component)
endfunction

function! gin#component#status#unstaged() abort
  let component = 'component:status:unstaged'
  call gin#internal#component#init(component)
  return gin#internal#component#get(component)
endfunction

function! gin#component#status#conflicted() abort
  let component = 'component:status:conflicted'
  call gin#internal#component#init(component)
  return gin#internal#component#get(component)
endfunction

function! gin#component#status#preset_ascii() abort
  let component = 'component:status:preset:ascii'
  call gin#internal#component#init(component)
  return gin#internal#component#get(component)
endfunction

function! gin#component#status#preset_unicode() abort
  let component = 'component:status:preset:unicode'
  call gin#internal#component#init(component)
  return gin#internal#component#get(component)
endfunction
