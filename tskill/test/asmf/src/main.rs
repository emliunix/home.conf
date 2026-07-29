use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub enum SrcPos {
    None,
    Line(usize),
    Span { start: usize, end: usize },
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
pub enum Label {
    Named(String),
    Anonymous(usize),
}

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

pub struct Asm {
    pub node: AsmF<Box<Asm>>,
    pub src_pos: SrcPos,
}

impl Asm {
    pub fn new(node: AsmF<Box<Asm>>, src_pos: SrcPos) -> Self {
        Self { node, src_pos }
    }

    pub fn cata<B, F>(self, algebra: F) -> B
    where
        F: Fn(AsmF<B>) -> B,
    {
        let Asm { node, src_pos: _ } = self;

        let mapped = node.map(|boxed_asm| {
            let Asm { node, src_pos: _ } = *boxed_asm;
            node.map(|inner_boxed| inner_boxed.cata(&algebra))
        });

        algebra(mapped)
    }

    pub fn cata_preserve<B, F>(self, algebra: F) -> B
    where
        F: Fn(AsmF<B>, SrcPos) -> B,
    {
        let Asm { node, src_pos } = self;

        let mapped = node.map(|boxed_asm| boxed_asm.cata_preserve(&algebra));

        algebra(mapped, src_pos)
    }

    pub fn ana<B, F>(seed: B, coalgebra: F) -> Self
    where
        F: Fn(B) -> AsmF<B>,
    {
        let functor = coalgebra(seed);

        let node = functor.map(|inner_seed| Box::new(Self::ana(inner_seed, &coalgebra)));

        Asm {
            node,
            src_pos: SrcPos::None,
        }
    }
}

impl fmt::Debug for Asm {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Asm({:?} at {:?})", self.node, self.src_pos)
    }
}

#[derive(Debug, Clone)]
pub struct Instruction {
    pub kind: InstrKind,
    pub pos: SrcPos,
}

#[derive(Debug, Clone)]
pub enum InstrKind {
    Mov { dst: Reg, src: Operand },
    Add { dst: Reg, src: Operand },
    Label(Label),
    Jump(Label),
}

fn flatten_with_pos(asm: AsmF<Vec<Instruction>>, pos: SrcPos) -> Vec<Instruction> {
    match asm {
        AsmF::Seq(vecs) => {
            let mut result = vecs.into_iter().flatten().collect::<Vec<_>>();
            result.last_mut().map(|last| last.pos = pos.clone());
            result
        }
        AsmF::Mov { dst, src } => vec![Instruction {
            kind: InstrKind::Mov { dst, src },
            pos,
        }],
        AsmF::Add { dst, src } => vec![Instruction {
            kind: InstrKind::Add { dst, src },
            pos,
        }],
        AsmF::Label(l) => vec![Instruction {
            kind: InstrKind::Label(l),
            pos,
        }],
        AsmF::Jump(l) => vec![Instruction {
            kind: InstrKind::Jump(l),
            pos,
        }],
    }
}

fn count_instructions() -> usize {
    let mov_rax_rbx = Asm::new(
        AsmF::Mov {
            dst: Reg::Rax,
            src: Operand::Reg(Reg::Rbx),
        },
        SrcPos::Line(10),
    );

    let add_rax_imm = Asm::new(
        AsmF::Add {
            dst: Reg::Rax,
            src: Operand::Imm(42),
        },
        SrcPos::Line(11),
    );

    let seq = Asm::new(
        AsmF::Seq(vec![
            Box::new(mov_rax_rbx),
            Box::new(add_rax_imm),
        ]),
        SrcPos::None,
    );

    let flat = seq.clone().cata_preserve(flatten_with_pos);
    flat.len()
}

fn main() {
    println!("ASM Functor Demo!");
    println!("==================");

    let count = count_instructions();
    println!("Instruction count: {}", count);

    let mov = Asm::new(
        AsmF::Mov {
            dst: Reg::Rax,
            src: Operand::Imm(123),
        },
        SrcPos::Line(1),
    );

    println!("\nCreated MOV instruction at line 1");

    let depth = mov.clone().cata(|node| match node {
        AsmF::Mov { .. } => 1,
        AsmF::Seq(v) => v.into_iter().max().unwrap_or(0) + 1,
        _ => 1,
    });

    println!("Tree depth: {}", depth);

    let label = Asm::new(
        AsmF::Label(Label::Named("loop_start".to_string())),
        SrcPos::Line(5),
    );

    let jump = Asm::new(
        AsmF::Jump(Label::Named("loop_start".to_string())),
        SrcPos::Line(15),
    );

    let program = Asm::new(
        AsmF::Seq(vec![
            Box::new(label),
            Box::new(mov),
            Box::new(jump),
        ]),
        SrcPos::None,
    );

    println!("\n--- Full Program ---");
    let instructions = program.cata_preserve(flatten_with_pos);
    for (i, instr) in instructions.iter().enumerate() {
        println!("{:2}: {:?} at {:?}", i + 1, instr.kind, instr.pos);
    }
}
