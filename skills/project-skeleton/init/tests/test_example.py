from example import one_function


def test_example_property():
    """P-core-01: one_function returns the same value when called twice with the
    same input. Replace with the witness of a real property."""
    for value in (-3, 0, 7):
        assert one_function(value) == one_function(value)
