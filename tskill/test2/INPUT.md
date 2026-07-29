> I need it to handle the fancy Box and potential node annotations for me, say the src_pos

Ah, you want the functor to handle the Box plumbing and annotations like source positions automatically! Here's a practical pattern:

Functor Layer with Auto-Boxing + Annotations

1. Functor Layer (Generic over recursive positions)

```rust
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
```

2. Recursive Type with Annotation

```rust
pub struct Asm {
    pub node: AsmF<Box<Asm>>,
    pub src_pos: SrcPos,
}
```

3. Cata (Automatic Box + Annotation Handling)

```rust
impl Asm {
    pub fn cata<B, F>(self, algebra: F) -> B
    where
        F: Fn(AsmF<B>) -> B,
    {
        let Asm { node, src_pos } = self;

        let mapped = node.map(|boxed_asm| {
            let Asm { node, src_pos: _ } = *boxed_asm;
            node.map(|inner_boxed| inner_boxed.cata(&algebra))
        });

        algebra(mapped)
    }
}
```

4. Ana (Automatic Box + Annotation Construction)

```rust
impl Asm {
    pub fn ana<B, F>(seed: B, coalgebra: F) -> Self
    where
        F: Fn(B) -> AsmF<B>,
    {
        let functor = coalgebra(seed);

        let node = functor.map(|inner_seed| {
            Box::new(Self::ana(inner_seed, &coalgebra))
        });

        Asm {
            node,
            src_pos: SrcPos::None,
        }
    }
}
```

5. More Convenient: Preserving Annotations

```rust
impl Asm {
    pub fn cata_preserve<B, F>(self, algebra: F) -> B
    where
        F: Fn(AsmF<B>, SrcPos) -> B,
    {
        let Asm { node, src_pos } = self;

        let mapped = node.map(|boxed_asm| {
            boxed_asm.cata_preserve(&algebra)
        });

        algebra(mapped, src_pos)
    }
}
```

Example: Flatten with Positions

```rust
fn flatten_with_pos(asm: AsmF<Vec<Instruction>>, pos: SrcPos) -> Vec<Instruction> {
    match asm {
        AsmF::Seq(vecs) => {
            let mut result = vecs.into_iter().flatten().collect::<Vec<_>>();
            result.last_mut().map(|last| last.pos = pos);
            result
        },
        AsmF::Mov { dst, src } => vec![Instruction {
            kind: InstrKind::Mov { dst, src },
            pos,
        }],
        AsmF::Add { dst, src } => vec![Instruction {
            kind: InstrKind::Add { dst, src },
            pos,
        }],
        _ => vec![],
    }
}

let flat = asm.cata_preserve(flatten_with_pos);
```

Alternative: Separate Wrapper for Annotations

```rust
pub struct Spanned<T> {
    pub value: T,
    pub span: Span,
}

pub type Asm = Spanned<AsmF<Box<Asm>>>;

impl Asm {
    pub fn cata<B, F>(self, algebra: F) -> B
    where
        F: Fn(Spanned<AsmF<B>>) -> B,
    {
        let Spanned { value, span } = self;

        let mapped = value.map(|boxed| boxed.cata(algebra));

        algebra(Spanned { value: mapped, span })
    }
}
```

  This keeps the annotation layer separate and composable!

> let's create a sample asmf.rs project to validate the code, the spec: SrcPos, Reg, Mov/Add/Label/Jump/Seq

