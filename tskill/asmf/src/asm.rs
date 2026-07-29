use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub struct SrcPos {
    pub line: usize,
    pub col: usize,
}

impl SrcPos {
    pub fn none() -> Self {
        SrcPos { line: 0, col: 0 }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum Reg {
    Rax,
    Rbx,
    Rcx,
    Rdx,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Operand {
    Reg(Reg),
    Imm(i64),
}

#[derive(Debug, Clone, PartialEq)]
pub struct Label(pub String);

#[derive(Debug, Clone, PartialEq)]
pub enum AsmF<R> {
    Mov { dst: Reg, src: Operand },
    Add { dst: Reg, src: Operand },
    Label(Label),
    Jump(Label),
    Seq(Vec<R>),
}

impl<R> AsmF<R> {
    pub fn map<S, F>(self, f: F) -> AsmF<S>
    where
        F: FnMut(R) -> S,
    {
        match self {
            AsmF::Mov { dst, src } => AsmF::Mov { dst, src },
            AsmF::Add { dst, src } => AsmF::Add { dst, src },
            AsmF::Label(l) => AsmF::Label(l),
            AsmF::Jump(l) => AsmF::Jump(l),
            AsmF::Seq(vec) => AsmF::Seq(vec.into_iter().map(f).collect()),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Asm {
    pub node: AsmF<Box<Asm>>,
    pub src_pos: SrcPos,
}

impl Asm {
    pub fn new(node: AsmF<Box<Asm>>) -> Self {
        Asm {
            node,
            src_pos: SrcPos::none(),
        }
    }

    pub fn with_pos(mut self, line: usize, col: usize) -> Self {
        self.src_pos = SrcPos { line, col };
        self
    }

    pub fn mov(dst: Reg, src: Operand) -> Self {
        Asm::new(AsmF::Mov { dst, src })
    }

    pub fn add(dst: Reg, src: Operand) -> Self {
        Asm::new(AsmF::Add { dst, src })
    }

    pub fn label(name: impl Into<String>) -> Self {
        Asm::new(AsmF::Label(Label(name.into())))
    }

    pub fn jump(name: impl Into<String>) -> Self {
        Asm::new(AsmF::Jump(Label(name.into())))
    }

    pub fn seq(children: Vec<Asm>) -> Self {
        Asm::new(AsmF::Seq(
            children.into_iter().map(Box::new).collect(),
        ))
    }
}

impl Asm {
    pub fn cata<B, F>(&self, algebra: &mut F) -> B
    where
        F: FnMut(AsmF<B>) -> B,
    {
        let mapped = match &self.node {
            AsmF::Seq(vec) => {
                let cataed: Vec<B> = vec.iter().map(|boxed| boxed.cata(algebra)).collect();
                AsmF::Seq(cataed)
            }
            AsmF::Mov { dst, src } => AsmF::Mov { dst: dst.clone(), src: src.clone() },
            AsmF::Add { dst, src } => AsmF::Add { dst: dst.clone(), src: src.clone() },
            AsmF::Label(l) => AsmF::Label(l.clone()),
            AsmF::Jump(l) => AsmF::Jump(l.clone()),
        };

        algebra(mapped)
    }
}

impl Asm {
    pub fn cata_preserve<B, F>(&self, algebra: &mut F) -> B
    where
        F: FnMut(AsmF<B>, SrcPos) -> B,
    {
        let src_pos = self.src_pos.clone();

        let mapped = match &self.node {
            AsmF::Seq(vec) => {
                let cataed: Vec<B> = vec.iter().map(|boxed| boxed.cata_preserve(algebra)).collect();
                AsmF::Seq(cataed)
            }
            AsmF::Mov { dst, src } => AsmF::Mov { dst: dst.clone(), src: src.clone() },
            AsmF::Add { dst, src } => AsmF::Add { dst: dst.clone(), src: src.clone() },
            AsmF::Label(l) => AsmF::Label(l.clone()),
            AsmF::Jump(l) => AsmF::Jump(l.clone()),
        };

        algebra(mapped, src_pos)
    }
}

impl fmt::Display for Asm {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.fmt_helper(f, 0)
    }
}

impl Asm {
    fn fmt_helper(&self, f: &mut fmt::Formatter<'_>, depth: usize) -> fmt::Result {
        let indent = "  ".repeat(depth);
        match &self.node {
            AsmF::Mov { dst, src } => writeln!(f, "{}mov {:?}, {:?}", indent, dst, src)?,
            AsmF::Add { dst, src } => writeln!(f, "{}add {:?}, {:?}", indent, dst, src)?,
            AsmF::Label(Label(name)) => writeln!(f, "{}{}:", indent, name)?,
            AsmF::Jump(Label(name)) => writeln!(f, "{}jmp {}", indent, name)?,
            AsmF::Seq(children) => {
                for child in children {
                    child.fmt_helper(f, depth)?;
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_instructions() {
        let mov = Asm::mov(Reg::Rax, Operand::Imm(42));
        assert!(matches!(mov.node, AsmF::Mov { .. }));
    }

    #[test]
    fn test_nested_seq() {
        let asm = Asm::seq(vec![
            Asm::mov(Reg::Rax, Operand::Imm(42)).with_pos(1, 0),
            Asm::seq(vec![
                Asm::add(Reg::Rax, Operand::Imm(1)).with_pos(2, 4),
                Asm::jump("done").with_pos(3, 0),
            ])
            .with_pos(1, 0),
        ]);

        assert!(matches!(asm.node, AsmF::Seq(_)));
    }

    #[test]
    fn test_cata_count() {
        let asm = Asm::seq(vec![
            Asm::mov(Reg::Rax, Operand::Imm(42)),
            Asm::seq(vec![
                Asm::add(Reg::Rax, Operand::Imm(1)),
                Asm::jump("done"),
            ]),
        ]);

        let mut algebra = |node| match node {
            AsmF::Seq(vec) => vec.iter().sum(),
            AsmF::Mov { .. } | AsmF::Add { .. } | AsmF::Label(_) | AsmF::Jump(_) => 1,
        };

        let result = asm.cata(&mut algebra);
        assert_eq!(result, 3);
    }

    #[test]
    fn test_cata_preserve() {
        let asm = Asm::seq(vec![
            Asm::mov(Reg::Rax, Operand::Imm(42)).with_pos(1, 0),
            Asm::add(Reg::Rax, Operand::Imm(1)).with_pos(2, 4),
        ]);

        let mut algebra = |node, pos| match node {
            AsmF::Seq(vec) => vec.into_iter().flatten().collect::<Vec<_>>(),
            AsmF::Mov { .. } | AsmF::Add { .. } | AsmF::Label(_) | AsmF::Jump(_) => {
                vec![pos]
            }
        };

        let positions = asm.cata_preserve(&mut algebra);
        assert_eq!(positions.len(), 2);
        assert_eq!(positions[0].line, 1);
        assert_eq!(positions[1].line, 2);
    }

    #[test]
    fn test_flatten() {
        let asm = Asm::seq(vec![
            Asm::mov(Reg::Rax, Operand::Imm(42)),
            Asm::seq(vec![
                Asm::add(Reg::Rax, Operand::Imm(1)),
                Asm::jump("done"),
            ]),
        ]);

        #[derive(Debug, PartialEq)]
        enum FlatInstr {
            Mov { dst: Reg, src: Operand },
            Add { dst: Reg, src: Operand },
            Jump(String),
        }

        let mut algebra = |node| match node {
            AsmF::Seq(vecs) => vecs.into_iter().flatten().collect::<Vec<_>>(),
            AsmF::Mov { dst, src } => vec![FlatInstr::Mov { dst, src }],
            AsmF::Add { dst, src } => vec![FlatInstr::Add { dst, src }],
            AsmF::Jump(Label(name)) => vec![FlatInstr::Jump(name)],
            AsmF::Label(_) => vec![],
        };

        let flat = asm.cata(&mut algebra);
        assert_eq!(flat.len(), 3);
        assert!(matches!(flat[0], FlatInstr::Mov { .. }));
        assert!(matches!(flat[1], FlatInstr::Add { .. }));
        assert!(matches!(flat[2], FlatInstr::Jump(_)));
    }
}
