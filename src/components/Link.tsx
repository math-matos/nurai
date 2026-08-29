interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  para: string
  children: React.ReactNode
}

export function Link({ para, children, onClick, ...resto }: LinkProps) {
  return (
    <a
      href={`#${para}`}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented) return
        window.scrollTo({ top: 0 })
      }}
      {...resto}
    >
      {children}
    </a>
  )
}
