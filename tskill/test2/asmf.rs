use std::fmt;

// Source position for tracking locations in source code
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SrcPos {
    pub line: usize,
    pub column: usize,
}

impl SrcPos {
    pub fn none() -> Self {
        SrcPos { line: 0, column: 0 }
    }
}

// Register representation
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Reg {
    Rax,
    Rbx,
    Rcx,
    Rdx,
    R8,
    R9,
    R10,
    R11,
}

impl fmt::Display for Reg {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Reg::Rax => write!(f, "rax"),
            Reg::Rbx => write!(f, "rbx"),
            Reg::Rcx => write!(f, "rcx"),
            Reg::Rdx => write!(f, "rdx"),
            Reg::R8 => write!(f, "r8"),
            Reg::R9 => write!(f, "r9"),
            Reg::R10 => write!(f, "r10"),
            Reg::R11 => write!(f, "r11"),
        }
    }
}

// Operand can be register or immediate
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Operand {
    Reg(Reg),
    Imm(i64),
}

impl fmt::Display for Operand {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Operand::Reg(r) => write!(f, "{}", r),
            Operand::Imm(i) => write!(f, "{}", i),
        }
    }
}

// Label for jumps
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Label(pub String);

impl fmt::Display for Label {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

// ASM Functor - parameterized by recursive positions
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AsmF<R> {
    Mov { dst: Reg, src: Operand },
    Add { dst: Reg, src: Operand },
    Label(Label),
    Jump(Label),
    Seq(Vec<R>),
}

impl<R> AsmF<R> {
    pub fn map<S, F>(self, mut f: F) -> AsmF<S>
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

// Recursive ASM type with annotations
#[derive(Debug, Clone)]
pub struct Asm {
    pub node: AsmF<Box<Asm>>,
    pub src_pos: SrcPos,
}

impl Asm {
    // Catamorphism - fold the structure
    pub fn cata<B, F>(self, algebra: &F) -> B
    where
        F: Fn(AsmF<B>) -> B,
    {
        let Asm { node, src_pos: _ } = self;
        
        let mapped = node.map(|boxed_asm| {
            boxed_asm.cata(algebra)
        });
        
        algebra(mapped)
    }
    
    // Catamorphism that preserves source positions
    pub fn cata_preserve<B, F>(self, algebra: &F) -> B
    where
        F: Fn(AsmF<B>, SrcPos) -> B,
    {
        let Asm { node, src_pos } = self;
        
        let mapped = node.map(|boxed_asm| {
            boxed_asm.cata_preserve(algebra)
        });
        
        algebra(mapped, src_pos)
    }
    
    // Anamorphism - unfold into the structure
    pub fn ana<B, F>(seed: B, coalgebra: &F) -> Self
    where
        F: Fn(B) -> AsmF<B> + Copy,
    {
        let functor = coalgebra(seed);
        
        let node = functor.map(|inner_seed| {
            Box::new(Self::ana(inner_seed, coalgebra))
        });
        
        Asm {
            node,
            src_pos: SrcPos::none(),
        }
    }
}

// Helper constructors
impl Asm {
    pub fn mov(dst: Reg, src: Operand) -> Self {
        Asm {
            node: AsmF::Mov { dst, src },
            src_pos: SrcPos::none(),
        }
    }
    
    pub fn add(dst: Reg, src: Operand) -> Self {
        Asm {
            node: AsmF::Add { dst, src },
            src_pos: SrcPos::none(),
        }
    }
    
    pub fn label(name: &str) -> Self {
        Asm {
            node: AsmF::Label(Label(name.to_string())),
            src_pos: SrcPos::none(),
        }
    }
    
    pub fn jump(label: &str) -> Self {
        Asm {
            node: AsmF::Jump(Label(label.to_string())),
            src_pos: SrcPos::none(),
        }
    }
    
    pub fn seq(instructions: Vec<Asm>) -> Self {
        Asm {
            node: AsmF::Seq(instructions.into_iter().map(Box::new).collect()),
            src_pos: SrcPos::none(),
        }
    }
    
    pub fn with_pos(mut self, line: usize, column: usize) -> Self {
        self.src_pos = SrcPos { line, column };
        self
    }
}

// Example: Flattened instruction type
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

// Example algebra: flatten to instruction list
pub fn flatten_algebra(asm: AsmF<Vec<Instruction>>, pos: SrcPos) -> Vec<Instruction> {
    match asm {
        AsmF::Seq(vecs) => {
            vecs.into_iter().flatten().collect()
        },
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

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_basic_construction() {
        let asm = Asm::seq(vec![
            Asm::mov(Reg::Rax, Operand::Imm(42)).with_pos(1, 0),
            Asm::add(Reg::Rax, Operand::Reg(Reg::Rbx)).with_pos(2, 0),
            Asm::label("loop_start").with_pos(3, 0),
            Asm::jump("loop_start").with_pos(4, 0),
        ]);
        
        // Test that we can construct the AST
        match &asm.node {
            AsmF::Seq(instrs) => assert_eq!(instrs.len(), 4),
            _ => panic!("Expected Seq"),
        }
    }
    
    #[test]
    fn test_cata_flatten() {
        let asm = Asm::seq(vec![
            Asm::mov(Reg::Rax, Operand::Imm(42)).with_pos(1, 0),
            Asm::seq(vec![
                Asm::add(Reg::Rax, Operand::Imm(1)).with_pos(2, 4),
                Asm::add(Reg::Rax, Operand::Imm(2)).with_pos(3, 4),
            ]).with_pos(2, 0),
            Asm::jump("end").with_pos(4, 0),
        ]).with_pos(0, 0);
        
        let flattened = asm.cata_preserve(&flatten_algebra);
        
        assert_eq!(flattened.len(), 4);
        assert_eq!(flattened[0].pos.line, 1);
        assert_eq!(flattened[1].pos.line, 2);
        assert_eq!(flattened[2].pos.line, 3);
        assert_eq!(flattened[3].pos.line, 4);
    }
    
    #[test]
    fn test_cata_count() {
        let asm = Asm::seq(vec![
            Asm::mov(Reg::Rax, Operand::Imm(42)),
            Asm::seq(vec![
                Asm::add(Reg::Rax, Operand::Imm(1)),
                Asm::add(Reg::Rax, Operand::Imm(2)),
            ]),
            Asm::label("end"),
            Asm::jump("end"),
        ]);
        
        // Count total instructions
        let count = asm.cata(&|node: AsmF<usize>| -> usize {
            match node {
                AsmF::Seq(counts) => counts.into_iter().sum(),
                _ => 1,
            }
        });
        
        assert_eq!(count, 5); // 2 movs, 2 adds, 1 label, 1 jump
    }
    
    #[test]
    fn test_ana_unfold() {
        // Generate a sequence of moves from 0..5
        enum GenState {
            Mov(i32),
            Rest(std::ops::Range<i32>),
        }
        
        let asm = Asm::ana(GenState::Rest(0..5), &|state: GenState| {
            match state {
                GenState::Rest(range) => {
                    if range.is_empty() {
                        AsmF::Seq(vec![])
                    } else {
                        let mut iter = range.clone();
                        let first = iter.next().unwrap();
                        AsmF::Seq(vec![
                            GenState::Mov(first),
                            GenState::Rest(iter),
                        ])
                    }
                },
                GenState::Mov(n) => {
                    AsmF::Mov { 
                        dst: Reg::Rax, 
                        src: Operand::Imm(n as i64) 
                    }
                }
            }
        });
        
        // Flatten and check we got 5 moves
        let flattened = asm.cata_preserve(&flatten_algebra);
        assert_eq!(flattened.len(), 5);
        
        for (i, instr) in flattened.iter().enumerate() {
            match &instr.kind {
                InstrKind::Mov { dst: Reg::Rax, src: Operand::Imm(n) } => {
                    assert_eq!(*n, i as i64);
                },
                _ => panic!("Expected Mov instruction"),
            }
        }
    }
}

fn main() {
    // Example usage
    let program = Asm::seq(vec![
        Asm::label("_start").with_pos(1, 0),
        Asm::mov(Reg::Rax, Operand::Imm(0)).with_pos(2, 4),
        Asm::label("loop").with_pos(3, 0),
        Asm::add(Reg::Rax, Operand::Imm(1)).with_pos(4, 4),
        Asm::jump("loop").with_pos(5, 4),
    ]).with_pos(0, 0);
    
    println!("Original AST:");
    println!("{:#?}", program);
    
    println!("\nFlattened instructions:");
    let instructions = program.cata_preserve(&flatten_algebra);
    for instr in &instructions {
        println!("  {:?} at {}:{}", instr.kind, instr.pos.line, instr.pos.column);
    }
}