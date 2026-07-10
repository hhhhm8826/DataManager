const _: () = ::protobuf::__internal::assert_compatible_gencode_version("4.34.1-release");
#[repr(transparent)]
#[derive(Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct FixtureState(i32);

#[allow(non_upper_case_globals)]
impl FixtureState {
  pub const None: FixtureState = FixtureState(0);
  pub const Active: FixtureState = FixtureState(1);
  pub const Max: FixtureState = FixtureState(2);

  fn constant_name(&self) -> ::std::option::Option<&'static str> {
    #[allow(unreachable_patterns)] // In the case of aliases, just emit them all and let the first one match.
    Some(match self.0 {
      0 => "None",
      1 => "Active",
      2 => "Max",
      _ => return None
    })
  }
}

impl ::std::convert::From<FixtureState> for i32 {
  fn from(val: FixtureState) -> i32 {
    val.0
  }
}

impl ::std::convert::From<i32> for FixtureState {
  fn from(val: i32) -> FixtureState {
    Self(val)
  }
}

impl ::std::default::Default for FixtureState {
  fn default() -> Self {
    Self(0)
  }
}

impl ::std::fmt::Debug for FixtureState {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    if let Some(constant_name) = self.constant_name() {
      write!(f, "FixtureState::{}", constant_name)
    } else {
      write!(f, "FixtureState::from({})", self.0)
    }
  }
}

impl ::protobuf::IntoProxied<i32> for FixtureState {
  fn into_proxied(self, _: ::protobuf::__internal::Private) -> i32 {
    self.0
  }
}

impl ::protobuf::__internal::SealedInternal for FixtureState {}

impl ::protobuf::Proxied for FixtureState {
  type View<'a> = FixtureState;
}

impl ::protobuf::AsView for FixtureState {
  type Proxied = FixtureState;

  fn as_view(&self) -> FixtureState {
    *self
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for FixtureState {
  fn into_view<'shorter>(self) -> FixtureState where 'msg: 'shorter {
    self
  }
}

// SAFETY: this is an enum type
unsafe impl ::protobuf::__internal::Enum for FixtureState {
  const NAME: &'static str = "FixtureState";

  fn is_known(value: i32) -> bool {
    matches!(value, 0|1|2)
  }
}

impl ::protobuf::__internal::runtime::EntityType for FixtureState {
    type Tag = ::protobuf::__internal::runtime::EnumTag;
}


