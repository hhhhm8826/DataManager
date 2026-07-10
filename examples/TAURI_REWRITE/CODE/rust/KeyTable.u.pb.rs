const _: () = ::protobuf::__internal::assert_compatible_gencode_version("4.34.1-release");
// This variable must not be referenced except by protobuf generated
// code.
pub(crate) static mut DATA_0MANAGER_0FIXTURE__SingleTarget_msg_init: ::protobuf::__internal::runtime::MiniTableInitPtr =
    ::protobuf::__internal::runtime::MiniTableInitPtr(::protobuf::__internal::runtime::MiniTablePtr::dangling());
#[allow(non_camel_case_types)]
pub struct SingleTarget {
  inner: ::protobuf::__internal::runtime::OwnedMessageInner<SingleTarget>
}

impl ::protobuf::Message for SingleTarget {}

impl ::std::default::Default for SingleTarget {
  fn default() -> Self {
    Self::new()
  }
}

impl ::std::fmt::Debug for SingleTarget {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

// SAFETY:
// - `SingleTarget` is `Sync` because it does not implement interior mutability.
//    Neither does `SingleTargetMut`.
unsafe impl Sync for SingleTarget {}

// SAFETY:
// - `SingleTarget` is `Send` because it uniquely owns its arena and does
//   not use thread-local data.
unsafe impl Send for SingleTarget {}

impl ::protobuf::Proxied for SingleTarget {
  type View<'msg> = SingleTargetView<'msg>;
}

impl ::protobuf::__internal::SealedInternal for SingleTarget {}

impl ::protobuf::MutProxied for SingleTarget {
  type Mut<'msg> = SingleTargetMut<'msg>;
}

#[derive(Copy, Clone)]
#[allow(dead_code)]
pub struct SingleTargetView<'msg> {
  inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, SingleTarget>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for SingleTargetView<'msg> {}

impl<'msg> ::protobuf::MessageView<'msg> for SingleTargetView<'msg> {
  type Message = SingleTarget;
}

impl ::std::fmt::Debug for SingleTargetView<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl ::std::default::Default for SingleTargetView<'_> {
  fn default() -> SingleTargetView<'static> {
    ::protobuf::__internal::runtime::MessageViewInner::default().into()
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageViewInner<'msg, SingleTarget>> for SingleTargetView<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, SingleTarget>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> SingleTargetView<'msg> {

  pub fn to_owned(&self) -> SingleTarget {
    ::protobuf::IntoProxied::into_proxied(*self, ::protobuf::__internal::Private)
  }

  // id: optional int32
  pub fn id(self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }

  // label: optional string
  pub fn label(self) -> ::protobuf::View<'msg, ::protobuf::ProtoString> {
    let str_view = unsafe {
      self.inner.ptr().get_string_at_index(
        1, (b"").into()
      )
    };
    // SAFETY: The runtime doesn't require ProtoStr to be UTF-8.
    unsafe { ::protobuf::ProtoStr::from_utf8_unchecked(str_view.as_ref()) }
  }

  // state: optional enum DATA_MANAGER_FIXTURE.FixtureState
  pub fn state(self) -> super::FixtureState {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        2, (super::FixtureState::None).into()
      ).try_into().unwrap()
    }
  }

}

// SAFETY:
// - `SingleTargetView` is `Sync` because it does not support mutation.
unsafe impl Sync for SingleTargetView<'_> {}

// SAFETY:
// - `SingleTargetView` is `Send` because while its alive a `SingleTargetMut` cannot.
// - `SingleTargetView` does not use thread-local data.
unsafe impl Send for SingleTargetView<'_> {}

impl<'msg> ::protobuf::AsView for SingleTargetView<'msg> {
  type Proxied = SingleTarget;
  fn as_view(&self) -> ::protobuf::View<'msg, SingleTarget> {
    *self
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for SingleTargetView<'msg> {
  fn into_view<'shorter>(self) -> SingleTargetView<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

impl<'msg> ::protobuf::IntoProxied<SingleTarget> for SingleTargetView<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> SingleTarget {
    let mut dst = SingleTarget::new();
    assert!(unsafe {
      dst.inner.ptr_mut().deep_copy(self.inner.ptr(), dst.inner.arena())
    });
    dst
  }
}

impl<'msg> ::protobuf::IntoProxied<SingleTarget> for SingleTargetMut<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> SingleTarget {
    ::protobuf::IntoProxied::into_proxied(::protobuf::IntoView::into_view(self), _private)
  }
}

impl ::protobuf::__internal::runtime::EntityType for SingleTarget {
    type Tag = ::protobuf::__internal::runtime::MessageTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for SingleTargetView<'msg> {
    type Tag = ::protobuf::__internal::runtime::ViewProxyTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for SingleTargetMut<'msg> {
    type Tag = ::protobuf::__internal::runtime::MutProxyTag;
}

#[allow(dead_code)]
#[allow(non_camel_case_types)]
pub struct SingleTargetMut<'msg> {
  inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, SingleTarget>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for SingleTargetMut<'msg> {}

impl<'msg> ::protobuf::MessageMut<'msg> for SingleTargetMut<'msg> {
  type Message = SingleTarget;
}

impl ::std::fmt::Debug for SingleTargetMut<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageMutInner<'msg, SingleTarget>> for SingleTargetMut<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, SingleTarget>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> SingleTargetMut<'msg> {

  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private)
    -> ::protobuf::__internal::runtime::MessageMutInner<'msg, SingleTarget> {
    self.inner
  }

  pub fn to_owned(&self) -> SingleTarget {
    ::protobuf::AsView::as_view(self).to_owned()
  }

  // id: optional int32
  pub fn id(&self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_id(&mut self, val: i32) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        0, val.into()
      )
    }
  }

  // label: optional string
  pub fn label(&self) -> ::protobuf::View<'_, ::protobuf::ProtoString> {
    let str_view = unsafe {
      self.inner.ptr().get_string_at_index(
        1, (b"").into()
      )
    };
    // SAFETY: The runtime doesn't require ProtoStr to be UTF-8.
    unsafe { ::protobuf::ProtoStr::from_utf8_unchecked(str_view.as_ref()) }
  }
  pub fn set_label(&mut self, val: impl ::protobuf::IntoProxied<::protobuf::ProtoString>) {
    unsafe {
      ::protobuf::__internal::runtime::message_set_string_field(
        ::protobuf::AsMut::as_mut(self).inner,
        1,
        val);
    }
  }

  // state: optional enum DATA_MANAGER_FIXTURE.FixtureState
  pub fn state(&self) -> super::FixtureState {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        2, (super::FixtureState::None).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_state(&mut self, val: super::FixtureState) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        2, val.into()
      )
    }
  }

}

// SAFETY:
// - `SingleTargetMut` does not perform any shared mutation.
unsafe impl Send for SingleTargetMut<'_> {}

// SAFETY:
// - `SingleTargetMut` does not perform any shared mutation.
unsafe impl Sync for SingleTargetMut<'_> {}

impl<'msg> ::protobuf::AsView for SingleTargetMut<'msg> {
  type Proxied = SingleTarget;
  fn as_view(&self) -> ::protobuf::View<'_, SingleTarget> {
    SingleTargetView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for SingleTargetMut<'msg> {
  fn into_view<'shorter>(self) -> ::protobuf::View<'shorter, SingleTarget>
  where
      'msg: 'shorter {
    SingleTargetView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::AsMut for SingleTargetMut<'msg> {
  type MutProxied = SingleTarget;
  fn as_mut(&mut self) -> SingleTargetMut<'msg> {
    SingleTargetMut { inner: self.inner }
  }
}

impl<'msg> ::protobuf::IntoMut<'msg> for SingleTargetMut<'msg> {
  fn into_mut<'shorter>(self) -> SingleTargetMut<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

#[allow(dead_code)]
impl SingleTarget {
  pub fn new() -> Self {
    Self { inner: ::protobuf::__internal::runtime::OwnedMessageInner::<Self>::new() }
  }


  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessageMutInner<'_, SingleTarget> {
    ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner)
  }

  pub fn as_view(&self) -> SingleTargetView<'_> {
    ::protobuf::__internal::runtime::MessageViewInner::view_of_owned(&self.inner).into()
  }

  pub fn as_mut(&mut self) -> SingleTargetMut<'_> {
    ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner).into()
  }

  // id: optional int32
  pub fn id(&self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_id(&mut self, val: i32) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        0, val.into()
      )
    }
  }

  // label: optional string
  pub fn label(&self) -> ::protobuf::View<'_, ::protobuf::ProtoString> {
    let str_view = unsafe {
      self.inner.ptr().get_string_at_index(
        1, (b"").into()
      )
    };
    // SAFETY: The runtime doesn't require ProtoStr to be UTF-8.
    unsafe { ::protobuf::ProtoStr::from_utf8_unchecked(str_view.as_ref()) }
  }
  pub fn set_label(&mut self, val: impl ::protobuf::IntoProxied<::protobuf::ProtoString>) {
    unsafe {
      ::protobuf::__internal::runtime::message_set_string_field(
        ::protobuf::AsMut::as_mut(self).inner,
        1,
        val);
    }
  }

  // state: optional enum DATA_MANAGER_FIXTURE.FixtureState
  pub fn state(&self) -> super::FixtureState {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        2, (super::FixtureState::None).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_state(&mut self, val: super::FixtureState) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        2, val.into()
      )
    }
  }

}  // impl SingleTarget

impl ::std::ops::Drop for SingleTarget {
  #[inline]
  fn drop(&mut self) {
  }
}

impl ::std::clone::Clone for SingleTarget {
  fn clone(&self) -> Self {
    self.as_view().to_owned()
  }
}

impl ::protobuf::AsView for SingleTarget {
  type Proxied = Self;
  fn as_view(&self) -> SingleTargetView<'_> {
    self.as_view()
  }
}

impl ::protobuf::AsMut for SingleTarget {
  type MutProxied = Self;
  fn as_mut(&mut self) -> SingleTargetMut<'_> {
    self.as_mut()
  }
}

unsafe impl ::protobuf::__internal::runtime::AssociatedMiniTable for SingleTarget {
  fn mini_table() -> ::protobuf::__internal::runtime::MiniTablePtr {
    static ONCE_LOCK: ::std::sync::OnceLock<::protobuf::__internal::runtime::MiniTableInitPtr> =
        ::std::sync::OnceLock::new();
    unsafe {
      ONCE_LOCK.get_or_init(|| {
        super::DATA_0MANAGER_0FIXTURE__SingleTarget_msg_init.0 =
            ::protobuf::__internal::runtime::build_mini_table("$(P1X.P");
        ::protobuf::__internal::runtime::link_mini_table(
            super::DATA_0MANAGER_0FIXTURE__SingleTarget_msg_init.0, &[], &[]);
        ::protobuf::__internal::runtime::MiniTableInitPtr(super::DATA_0MANAGER_0FIXTURE__SingleTarget_msg_init.0)
      }).0
    }
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetArena for SingleTarget {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for SingleTarget {
  type Msg = SingleTarget;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<SingleTarget> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for SingleTarget {
  type Msg = SingleTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<SingleTarget> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for SingleTargetMut<'_> {
  type Msg = SingleTarget;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<SingleTarget> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for SingleTargetMut<'_> {
  type Msg = SingleTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<SingleTarget> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for SingleTargetView<'_> {
  type Msg = SingleTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<SingleTarget> {
    self.inner.ptr()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetArena for SingleTargetMut<'_> {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}



// This variable must not be referenced except by protobuf generated
// code.
pub(crate) static mut DATA_0MANAGER_0FIXTURE__CompositeTarget_msg_init: ::protobuf::__internal::runtime::MiniTableInitPtr =
    ::protobuf::__internal::runtime::MiniTableInitPtr(::protobuf::__internal::runtime::MiniTablePtr::dangling());
#[allow(non_camel_case_types)]
pub struct CompositeTarget {
  inner: ::protobuf::__internal::runtime::OwnedMessageInner<CompositeTarget>
}

impl ::protobuf::Message for CompositeTarget {}

impl ::std::default::Default for CompositeTarget {
  fn default() -> Self {
    Self::new()
  }
}

impl ::std::fmt::Debug for CompositeTarget {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

// SAFETY:
// - `CompositeTarget` is `Sync` because it does not implement interior mutability.
//    Neither does `CompositeTargetMut`.
unsafe impl Sync for CompositeTarget {}

// SAFETY:
// - `CompositeTarget` is `Send` because it uniquely owns its arena and does
//   not use thread-local data.
unsafe impl Send for CompositeTarget {}

impl ::protobuf::Proxied for CompositeTarget {
  type View<'msg> = CompositeTargetView<'msg>;
}

impl ::protobuf::__internal::SealedInternal for CompositeTarget {}

impl ::protobuf::MutProxied for CompositeTarget {
  type Mut<'msg> = CompositeTargetMut<'msg>;
}

#[derive(Copy, Clone)]
#[allow(dead_code)]
pub struct CompositeTargetView<'msg> {
  inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, CompositeTarget>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for CompositeTargetView<'msg> {}

impl<'msg> ::protobuf::MessageView<'msg> for CompositeTargetView<'msg> {
  type Message = CompositeTarget;
}

impl ::std::fmt::Debug for CompositeTargetView<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl ::std::default::Default for CompositeTargetView<'_> {
  fn default() -> CompositeTargetView<'static> {
    ::protobuf::__internal::runtime::MessageViewInner::default().into()
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageViewInner<'msg, CompositeTarget>> for CompositeTargetView<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, CompositeTarget>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> CompositeTargetView<'msg> {

  pub fn to_owned(&self) -> CompositeTarget {
    ::protobuf::IntoProxied::into_proxied(*self, ::protobuf::__internal::Private)
  }

  // region: optional int32
  pub fn region(self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }

  // id: optional int32
  pub fn id(self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        1, (0i32).into()
      ).try_into().unwrap()
    }
  }

  // label: optional string
  pub fn label(self) -> ::protobuf::View<'msg, ::protobuf::ProtoString> {
    let str_view = unsafe {
      self.inner.ptr().get_string_at_index(
        2, (b"").into()
      )
    };
    // SAFETY: The runtime doesn't require ProtoStr to be UTF-8.
    unsafe { ::protobuf::ProtoStr::from_utf8_unchecked(str_view.as_ref()) }
  }

}

// SAFETY:
// - `CompositeTargetView` is `Sync` because it does not support mutation.
unsafe impl Sync for CompositeTargetView<'_> {}

// SAFETY:
// - `CompositeTargetView` is `Send` because while its alive a `CompositeTargetMut` cannot.
// - `CompositeTargetView` does not use thread-local data.
unsafe impl Send for CompositeTargetView<'_> {}

impl<'msg> ::protobuf::AsView for CompositeTargetView<'msg> {
  type Proxied = CompositeTarget;
  fn as_view(&self) -> ::protobuf::View<'msg, CompositeTarget> {
    *self
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for CompositeTargetView<'msg> {
  fn into_view<'shorter>(self) -> CompositeTargetView<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

impl<'msg> ::protobuf::IntoProxied<CompositeTarget> for CompositeTargetView<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> CompositeTarget {
    let mut dst = CompositeTarget::new();
    assert!(unsafe {
      dst.inner.ptr_mut().deep_copy(self.inner.ptr(), dst.inner.arena())
    });
    dst
  }
}

impl<'msg> ::protobuf::IntoProxied<CompositeTarget> for CompositeTargetMut<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> CompositeTarget {
    ::protobuf::IntoProxied::into_proxied(::protobuf::IntoView::into_view(self), _private)
  }
}

impl ::protobuf::__internal::runtime::EntityType for CompositeTarget {
    type Tag = ::protobuf::__internal::runtime::MessageTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for CompositeTargetView<'msg> {
    type Tag = ::protobuf::__internal::runtime::ViewProxyTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for CompositeTargetMut<'msg> {
    type Tag = ::protobuf::__internal::runtime::MutProxyTag;
}

#[allow(dead_code)]
#[allow(non_camel_case_types)]
pub struct CompositeTargetMut<'msg> {
  inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, CompositeTarget>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for CompositeTargetMut<'msg> {}

impl<'msg> ::protobuf::MessageMut<'msg> for CompositeTargetMut<'msg> {
  type Message = CompositeTarget;
}

impl ::std::fmt::Debug for CompositeTargetMut<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageMutInner<'msg, CompositeTarget>> for CompositeTargetMut<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, CompositeTarget>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> CompositeTargetMut<'msg> {

  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private)
    -> ::protobuf::__internal::runtime::MessageMutInner<'msg, CompositeTarget> {
    self.inner
  }

  pub fn to_owned(&self) -> CompositeTarget {
    ::protobuf::AsView::as_view(self).to_owned()
  }

  // region: optional int32
  pub fn region(&self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_region(&mut self, val: i32) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        0, val.into()
      )
    }
  }

  // id: optional int32
  pub fn id(&self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        1, (0i32).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_id(&mut self, val: i32) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        1, val.into()
      )
    }
  }

  // label: optional string
  pub fn label(&self) -> ::protobuf::View<'_, ::protobuf::ProtoString> {
    let str_view = unsafe {
      self.inner.ptr().get_string_at_index(
        2, (b"").into()
      )
    };
    // SAFETY: The runtime doesn't require ProtoStr to be UTF-8.
    unsafe { ::protobuf::ProtoStr::from_utf8_unchecked(str_view.as_ref()) }
  }
  pub fn set_label(&mut self, val: impl ::protobuf::IntoProxied<::protobuf::ProtoString>) {
    unsafe {
      ::protobuf::__internal::runtime::message_set_string_field(
        ::protobuf::AsMut::as_mut(self).inner,
        2,
        val);
    }
  }

}

// SAFETY:
// - `CompositeTargetMut` does not perform any shared mutation.
unsafe impl Send for CompositeTargetMut<'_> {}

// SAFETY:
// - `CompositeTargetMut` does not perform any shared mutation.
unsafe impl Sync for CompositeTargetMut<'_> {}

impl<'msg> ::protobuf::AsView for CompositeTargetMut<'msg> {
  type Proxied = CompositeTarget;
  fn as_view(&self) -> ::protobuf::View<'_, CompositeTarget> {
    CompositeTargetView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for CompositeTargetMut<'msg> {
  fn into_view<'shorter>(self) -> ::protobuf::View<'shorter, CompositeTarget>
  where
      'msg: 'shorter {
    CompositeTargetView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::AsMut for CompositeTargetMut<'msg> {
  type MutProxied = CompositeTarget;
  fn as_mut(&mut self) -> CompositeTargetMut<'msg> {
    CompositeTargetMut { inner: self.inner }
  }
}

impl<'msg> ::protobuf::IntoMut<'msg> for CompositeTargetMut<'msg> {
  fn into_mut<'shorter>(self) -> CompositeTargetMut<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

#[allow(dead_code)]
impl CompositeTarget {
  pub fn new() -> Self {
    Self { inner: ::protobuf::__internal::runtime::OwnedMessageInner::<Self>::new() }
  }


  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessageMutInner<'_, CompositeTarget> {
    ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner)
  }

  pub fn as_view(&self) -> CompositeTargetView<'_> {
    ::protobuf::__internal::runtime::MessageViewInner::view_of_owned(&self.inner).into()
  }

  pub fn as_mut(&mut self) -> CompositeTargetMut<'_> {
    ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner).into()
  }

  // region: optional int32
  pub fn region(&self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_region(&mut self, val: i32) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        0, val.into()
      )
    }
  }

  // id: optional int32
  pub fn id(&self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        1, (0i32).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_id(&mut self, val: i32) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        1, val.into()
      )
    }
  }

  // label: optional string
  pub fn label(&self) -> ::protobuf::View<'_, ::protobuf::ProtoString> {
    let str_view = unsafe {
      self.inner.ptr().get_string_at_index(
        2, (b"").into()
      )
    };
    // SAFETY: The runtime doesn't require ProtoStr to be UTF-8.
    unsafe { ::protobuf::ProtoStr::from_utf8_unchecked(str_view.as_ref()) }
  }
  pub fn set_label(&mut self, val: impl ::protobuf::IntoProxied<::protobuf::ProtoString>) {
    unsafe {
      ::protobuf::__internal::runtime::message_set_string_field(
        ::protobuf::AsMut::as_mut(self).inner,
        2,
        val);
    }
  }

}  // impl CompositeTarget

impl ::std::ops::Drop for CompositeTarget {
  #[inline]
  fn drop(&mut self) {
  }
}

impl ::std::clone::Clone for CompositeTarget {
  fn clone(&self) -> Self {
    self.as_view().to_owned()
  }
}

impl ::protobuf::AsView for CompositeTarget {
  type Proxied = Self;
  fn as_view(&self) -> CompositeTargetView<'_> {
    self.as_view()
  }
}

impl ::protobuf::AsMut for CompositeTarget {
  type MutProxied = Self;
  fn as_mut(&mut self) -> CompositeTargetMut<'_> {
    self.as_mut()
  }
}

unsafe impl ::protobuf::__internal::runtime::AssociatedMiniTable for CompositeTarget {
  fn mini_table() -> ::protobuf::__internal::runtime::MiniTablePtr {
    static ONCE_LOCK: ::std::sync::OnceLock<::protobuf::__internal::runtime::MiniTableInitPtr> =
        ::std::sync::OnceLock::new();
    unsafe {
      ONCE_LOCK.get_or_init(|| {
        super::DATA_0MANAGER_0FIXTURE__CompositeTarget_msg_init.0 =
            ::protobuf::__internal::runtime::build_mini_table("$(P(P1X");
        ::protobuf::__internal::runtime::link_mini_table(
            super::DATA_0MANAGER_0FIXTURE__CompositeTarget_msg_init.0, &[], &[]);
        ::protobuf::__internal::runtime::MiniTableInitPtr(super::DATA_0MANAGER_0FIXTURE__CompositeTarget_msg_init.0)
      }).0
    }
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetArena for CompositeTarget {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for CompositeTarget {
  type Msg = CompositeTarget;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<CompositeTarget> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for CompositeTarget {
  type Msg = CompositeTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<CompositeTarget> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for CompositeTargetMut<'_> {
  type Msg = CompositeTarget;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<CompositeTarget> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for CompositeTargetMut<'_> {
  type Msg = CompositeTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<CompositeTarget> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for CompositeTargetView<'_> {
  type Msg = CompositeTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<CompositeTarget> {
    self.inner.ptr()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetArena for CompositeTargetMut<'_> {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}



// This variable must not be referenced except by protobuf generated
// code.
pub(crate) static mut DATA_0MANAGER_0FIXTURE__GroupTarget_msg_init: ::protobuf::__internal::runtime::MiniTableInitPtr =
    ::protobuf::__internal::runtime::MiniTableInitPtr(::protobuf::__internal::runtime::MiniTablePtr::dangling());
#[allow(non_camel_case_types)]
pub struct GroupTarget {
  inner: ::protobuf::__internal::runtime::OwnedMessageInner<GroupTarget>
}

impl ::protobuf::Message for GroupTarget {}

impl ::std::default::Default for GroupTarget {
  fn default() -> Self {
    Self::new()
  }
}

impl ::std::fmt::Debug for GroupTarget {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

// SAFETY:
// - `GroupTarget` is `Sync` because it does not implement interior mutability.
//    Neither does `GroupTargetMut`.
unsafe impl Sync for GroupTarget {}

// SAFETY:
// - `GroupTarget` is `Send` because it uniquely owns its arena and does
//   not use thread-local data.
unsafe impl Send for GroupTarget {}

impl ::protobuf::Proxied for GroupTarget {
  type View<'msg> = GroupTargetView<'msg>;
}

impl ::protobuf::__internal::SealedInternal for GroupTarget {}

impl ::protobuf::MutProxied for GroupTarget {
  type Mut<'msg> = GroupTargetMut<'msg>;
}

#[derive(Copy, Clone)]
#[allow(dead_code)]
pub struct GroupTargetView<'msg> {
  inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, GroupTarget>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for GroupTargetView<'msg> {}

impl<'msg> ::protobuf::MessageView<'msg> for GroupTargetView<'msg> {
  type Message = GroupTarget;
}

impl ::std::fmt::Debug for GroupTargetView<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl ::std::default::Default for GroupTargetView<'_> {
  fn default() -> GroupTargetView<'static> {
    ::protobuf::__internal::runtime::MessageViewInner::default().into()
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageViewInner<'msg, GroupTarget>> for GroupTargetView<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, GroupTarget>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> GroupTargetView<'msg> {

  pub fn to_owned(&self) -> GroupTarget {
    ::protobuf::IntoProxied::into_proxied(*self, ::protobuf::__internal::Private)
  }

  // groupId: optional int32
  pub fn groupId(self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }

  // label: optional string
  pub fn label(self) -> ::protobuf::View<'msg, ::protobuf::ProtoString> {
    let str_view = unsafe {
      self.inner.ptr().get_string_at_index(
        1, (b"").into()
      )
    };
    // SAFETY: The runtime doesn't require ProtoStr to be UTF-8.
    unsafe { ::protobuf::ProtoStr::from_utf8_unchecked(str_view.as_ref()) }
  }

}

// SAFETY:
// - `GroupTargetView` is `Sync` because it does not support mutation.
unsafe impl Sync for GroupTargetView<'_> {}

// SAFETY:
// - `GroupTargetView` is `Send` because while its alive a `GroupTargetMut` cannot.
// - `GroupTargetView` does not use thread-local data.
unsafe impl Send for GroupTargetView<'_> {}

impl<'msg> ::protobuf::AsView for GroupTargetView<'msg> {
  type Proxied = GroupTarget;
  fn as_view(&self) -> ::protobuf::View<'msg, GroupTarget> {
    *self
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for GroupTargetView<'msg> {
  fn into_view<'shorter>(self) -> GroupTargetView<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

impl<'msg> ::protobuf::IntoProxied<GroupTarget> for GroupTargetView<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> GroupTarget {
    let mut dst = GroupTarget::new();
    assert!(unsafe {
      dst.inner.ptr_mut().deep_copy(self.inner.ptr(), dst.inner.arena())
    });
    dst
  }
}

impl<'msg> ::protobuf::IntoProxied<GroupTarget> for GroupTargetMut<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> GroupTarget {
    ::protobuf::IntoProxied::into_proxied(::protobuf::IntoView::into_view(self), _private)
  }
}

impl ::protobuf::__internal::runtime::EntityType for GroupTarget {
    type Tag = ::protobuf::__internal::runtime::MessageTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for GroupTargetView<'msg> {
    type Tag = ::protobuf::__internal::runtime::ViewProxyTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for GroupTargetMut<'msg> {
    type Tag = ::protobuf::__internal::runtime::MutProxyTag;
}

#[allow(dead_code)]
#[allow(non_camel_case_types)]
pub struct GroupTargetMut<'msg> {
  inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, GroupTarget>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for GroupTargetMut<'msg> {}

impl<'msg> ::protobuf::MessageMut<'msg> for GroupTargetMut<'msg> {
  type Message = GroupTarget;
}

impl ::std::fmt::Debug for GroupTargetMut<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageMutInner<'msg, GroupTarget>> for GroupTargetMut<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, GroupTarget>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> GroupTargetMut<'msg> {

  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private)
    -> ::protobuf::__internal::runtime::MessageMutInner<'msg, GroupTarget> {
    self.inner
  }

  pub fn to_owned(&self) -> GroupTarget {
    ::protobuf::AsView::as_view(self).to_owned()
  }

  // groupId: optional int32
  pub fn groupId(&self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_groupId(&mut self, val: i32) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        0, val.into()
      )
    }
  }

  // label: optional string
  pub fn label(&self) -> ::protobuf::View<'_, ::protobuf::ProtoString> {
    let str_view = unsafe {
      self.inner.ptr().get_string_at_index(
        1, (b"").into()
      )
    };
    // SAFETY: The runtime doesn't require ProtoStr to be UTF-8.
    unsafe { ::protobuf::ProtoStr::from_utf8_unchecked(str_view.as_ref()) }
  }
  pub fn set_label(&mut self, val: impl ::protobuf::IntoProxied<::protobuf::ProtoString>) {
    unsafe {
      ::protobuf::__internal::runtime::message_set_string_field(
        ::protobuf::AsMut::as_mut(self).inner,
        1,
        val);
    }
  }

}

// SAFETY:
// - `GroupTargetMut` does not perform any shared mutation.
unsafe impl Send for GroupTargetMut<'_> {}

// SAFETY:
// - `GroupTargetMut` does not perform any shared mutation.
unsafe impl Sync for GroupTargetMut<'_> {}

impl<'msg> ::protobuf::AsView for GroupTargetMut<'msg> {
  type Proxied = GroupTarget;
  fn as_view(&self) -> ::protobuf::View<'_, GroupTarget> {
    GroupTargetView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for GroupTargetMut<'msg> {
  fn into_view<'shorter>(self) -> ::protobuf::View<'shorter, GroupTarget>
  where
      'msg: 'shorter {
    GroupTargetView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::AsMut for GroupTargetMut<'msg> {
  type MutProxied = GroupTarget;
  fn as_mut(&mut self) -> GroupTargetMut<'msg> {
    GroupTargetMut { inner: self.inner }
  }
}

impl<'msg> ::protobuf::IntoMut<'msg> for GroupTargetMut<'msg> {
  fn into_mut<'shorter>(self) -> GroupTargetMut<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

#[allow(dead_code)]
impl GroupTarget {
  pub fn new() -> Self {
    Self { inner: ::protobuf::__internal::runtime::OwnedMessageInner::<Self>::new() }
  }


  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessageMutInner<'_, GroupTarget> {
    ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner)
  }

  pub fn as_view(&self) -> GroupTargetView<'_> {
    ::protobuf::__internal::runtime::MessageViewInner::view_of_owned(&self.inner).into()
  }

  pub fn as_mut(&mut self) -> GroupTargetMut<'_> {
    ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner).into()
  }

  // groupId: optional int32
  pub fn groupId(&self) -> i32 {
    unsafe {
      // TODO: b/361751487: This .into() and .try_into() is only
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      // perfectly (and do an unchecked conversion for
      // i32->enum types, since even for closed enums we trust
      // upb to only return one of the named values).
      self.inner.ptr().get_i32_at_index(
        0, (0i32).into()
      ).try_into().unwrap()
    }
  }
  pub fn set_groupId(&mut self, val: i32) {
    unsafe {
      // TODO: b/361751487: This .into() is only here
      // here for the enum<->i32 case, we should avoid it for
      // other primitives where the types naturally match
      //perfectly.
      self.inner.ptr_mut().set_base_field_i32_at_index(
        0, val.into()
      )
    }
  }

  // label: optional string
  pub fn label(&self) -> ::protobuf::View<'_, ::protobuf::ProtoString> {
    let str_view = unsafe {
      self.inner.ptr().get_string_at_index(
        1, (b"").into()
      )
    };
    // SAFETY: The runtime doesn't require ProtoStr to be UTF-8.
    unsafe { ::protobuf::ProtoStr::from_utf8_unchecked(str_view.as_ref()) }
  }
  pub fn set_label(&mut self, val: impl ::protobuf::IntoProxied<::protobuf::ProtoString>) {
    unsafe {
      ::protobuf::__internal::runtime::message_set_string_field(
        ::protobuf::AsMut::as_mut(self).inner,
        1,
        val);
    }
  }

}  // impl GroupTarget

impl ::std::ops::Drop for GroupTarget {
  #[inline]
  fn drop(&mut self) {
  }
}

impl ::std::clone::Clone for GroupTarget {
  fn clone(&self) -> Self {
    self.as_view().to_owned()
  }
}

impl ::protobuf::AsView for GroupTarget {
  type Proxied = Self;
  fn as_view(&self) -> GroupTargetView<'_> {
    self.as_view()
  }
}

impl ::protobuf::AsMut for GroupTarget {
  type MutProxied = Self;
  fn as_mut(&mut self) -> GroupTargetMut<'_> {
    self.as_mut()
  }
}

unsafe impl ::protobuf::__internal::runtime::AssociatedMiniTable for GroupTarget {
  fn mini_table() -> ::protobuf::__internal::runtime::MiniTablePtr {
    static ONCE_LOCK: ::std::sync::OnceLock<::protobuf::__internal::runtime::MiniTableInitPtr> =
        ::std::sync::OnceLock::new();
    unsafe {
      ONCE_LOCK.get_or_init(|| {
        super::DATA_0MANAGER_0FIXTURE__GroupTarget_msg_init.0 =
            ::protobuf::__internal::runtime::build_mini_table("$(P1X");
        ::protobuf::__internal::runtime::link_mini_table(
            super::DATA_0MANAGER_0FIXTURE__GroupTarget_msg_init.0, &[], &[]);
        ::protobuf::__internal::runtime::MiniTableInitPtr(super::DATA_0MANAGER_0FIXTURE__GroupTarget_msg_init.0)
      }).0
    }
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetArena for GroupTarget {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for GroupTarget {
  type Msg = GroupTarget;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<GroupTarget> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for GroupTarget {
  type Msg = GroupTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<GroupTarget> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for GroupTargetMut<'_> {
  type Msg = GroupTarget;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<GroupTarget> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for GroupTargetMut<'_> {
  type Msg = GroupTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<GroupTarget> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for GroupTargetView<'_> {
  type Msg = GroupTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<GroupTarget> {
    self.inner.ptr()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetArena for GroupTargetMut<'_> {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}



// This variable must not be referenced except by protobuf generated
// code.
pub(crate) static mut DATA_0MANAGER_0FIXTURE__NoKeyTarget_msg_init: ::protobuf::__internal::runtime::MiniTableInitPtr =
    ::protobuf::__internal::runtime::MiniTableInitPtr(::protobuf::__internal::runtime::MiniTablePtr::dangling());
#[allow(non_camel_case_types)]
pub struct NoKeyTarget {
  inner: ::protobuf::__internal::runtime::OwnedMessageInner<NoKeyTarget>
}

impl ::protobuf::Message for NoKeyTarget {}

impl ::std::default::Default for NoKeyTarget {
  fn default() -> Self {
    Self::new()
  }
}

impl ::std::fmt::Debug for NoKeyTarget {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

// SAFETY:
// - `NoKeyTarget` is `Sync` because it does not implement interior mutability.
//    Neither does `NoKeyTargetMut`.
unsafe impl Sync for NoKeyTarget {}

// SAFETY:
// - `NoKeyTarget` is `Send` because it uniquely owns its arena and does
//   not use thread-local data.
unsafe impl Send for NoKeyTarget {}

impl ::protobuf::Proxied for NoKeyTarget {
  type View<'msg> = NoKeyTargetView<'msg>;
}

impl ::protobuf::__internal::SealedInternal for NoKeyTarget {}

impl ::protobuf::MutProxied for NoKeyTarget {
  type Mut<'msg> = NoKeyTargetMut<'msg>;
}

#[derive(Copy, Clone)]
#[allow(dead_code)]
pub struct NoKeyTargetView<'msg> {
  inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, NoKeyTarget>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for NoKeyTargetView<'msg> {}

impl<'msg> ::protobuf::MessageView<'msg> for NoKeyTargetView<'msg> {
  type Message = NoKeyTarget;
}

impl ::std::fmt::Debug for NoKeyTargetView<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl ::std::default::Default for NoKeyTargetView<'_> {
  fn default() -> NoKeyTargetView<'static> {
    ::protobuf::__internal::runtime::MessageViewInner::default().into()
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageViewInner<'msg, NoKeyTarget>> for NoKeyTargetView<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, NoKeyTarget>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> NoKeyTargetView<'msg> {

  pub fn to_owned(&self) -> NoKeyTarget {
    ::protobuf::IntoProxied::into_proxied(*self, ::protobuf::__internal::Private)
  }

  // label: optional string
  pub fn label(self) -> ::protobuf::View<'msg, ::protobuf::ProtoString> {
    let str_view = unsafe {
      self.inner.ptr().get_string_at_index(
        0, (b"").into()
      )
    };
    // SAFETY: The runtime doesn't require ProtoStr to be UTF-8.
    unsafe { ::protobuf::ProtoStr::from_utf8_unchecked(str_view.as_ref()) }
  }

}

// SAFETY:
// - `NoKeyTargetView` is `Sync` because it does not support mutation.
unsafe impl Sync for NoKeyTargetView<'_> {}

// SAFETY:
// - `NoKeyTargetView` is `Send` because while its alive a `NoKeyTargetMut` cannot.
// - `NoKeyTargetView` does not use thread-local data.
unsafe impl Send for NoKeyTargetView<'_> {}

impl<'msg> ::protobuf::AsView for NoKeyTargetView<'msg> {
  type Proxied = NoKeyTarget;
  fn as_view(&self) -> ::protobuf::View<'msg, NoKeyTarget> {
    *self
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for NoKeyTargetView<'msg> {
  fn into_view<'shorter>(self) -> NoKeyTargetView<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

impl<'msg> ::protobuf::IntoProxied<NoKeyTarget> for NoKeyTargetView<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> NoKeyTarget {
    let mut dst = NoKeyTarget::new();
    assert!(unsafe {
      dst.inner.ptr_mut().deep_copy(self.inner.ptr(), dst.inner.arena())
    });
    dst
  }
}

impl<'msg> ::protobuf::IntoProxied<NoKeyTarget> for NoKeyTargetMut<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> NoKeyTarget {
    ::protobuf::IntoProxied::into_proxied(::protobuf::IntoView::into_view(self), _private)
  }
}

impl ::protobuf::__internal::runtime::EntityType for NoKeyTarget {
    type Tag = ::protobuf::__internal::runtime::MessageTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for NoKeyTargetView<'msg> {
    type Tag = ::protobuf::__internal::runtime::ViewProxyTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for NoKeyTargetMut<'msg> {
    type Tag = ::protobuf::__internal::runtime::MutProxyTag;
}

#[allow(dead_code)]
#[allow(non_camel_case_types)]
pub struct NoKeyTargetMut<'msg> {
  inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, NoKeyTarget>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for NoKeyTargetMut<'msg> {}

impl<'msg> ::protobuf::MessageMut<'msg> for NoKeyTargetMut<'msg> {
  type Message = NoKeyTarget;
}

impl ::std::fmt::Debug for NoKeyTargetMut<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageMutInner<'msg, NoKeyTarget>> for NoKeyTargetMut<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, NoKeyTarget>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> NoKeyTargetMut<'msg> {

  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private)
    -> ::protobuf::__internal::runtime::MessageMutInner<'msg, NoKeyTarget> {
    self.inner
  }

  pub fn to_owned(&self) -> NoKeyTarget {
    ::protobuf::AsView::as_view(self).to_owned()
  }

  // label: optional string
  pub fn label(&self) -> ::protobuf::View<'_, ::protobuf::ProtoString> {
    let str_view = unsafe {
      self.inner.ptr().get_string_at_index(
        0, (b"").into()
      )
    };
    // SAFETY: The runtime doesn't require ProtoStr to be UTF-8.
    unsafe { ::protobuf::ProtoStr::from_utf8_unchecked(str_view.as_ref()) }
  }
  pub fn set_label(&mut self, val: impl ::protobuf::IntoProxied<::protobuf::ProtoString>) {
    unsafe {
      ::protobuf::__internal::runtime::message_set_string_field(
        ::protobuf::AsMut::as_mut(self).inner,
        0,
        val);
    }
  }

}

// SAFETY:
// - `NoKeyTargetMut` does not perform any shared mutation.
unsafe impl Send for NoKeyTargetMut<'_> {}

// SAFETY:
// - `NoKeyTargetMut` does not perform any shared mutation.
unsafe impl Sync for NoKeyTargetMut<'_> {}

impl<'msg> ::protobuf::AsView for NoKeyTargetMut<'msg> {
  type Proxied = NoKeyTarget;
  fn as_view(&self) -> ::protobuf::View<'_, NoKeyTarget> {
    NoKeyTargetView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for NoKeyTargetMut<'msg> {
  fn into_view<'shorter>(self) -> ::protobuf::View<'shorter, NoKeyTarget>
  where
      'msg: 'shorter {
    NoKeyTargetView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::AsMut for NoKeyTargetMut<'msg> {
  type MutProxied = NoKeyTarget;
  fn as_mut(&mut self) -> NoKeyTargetMut<'msg> {
    NoKeyTargetMut { inner: self.inner }
  }
}

impl<'msg> ::protobuf::IntoMut<'msg> for NoKeyTargetMut<'msg> {
  fn into_mut<'shorter>(self) -> NoKeyTargetMut<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

#[allow(dead_code)]
impl NoKeyTarget {
  pub fn new() -> Self {
    Self { inner: ::protobuf::__internal::runtime::OwnedMessageInner::<Self>::new() }
  }


  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessageMutInner<'_, NoKeyTarget> {
    ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner)
  }

  pub fn as_view(&self) -> NoKeyTargetView<'_> {
    ::protobuf::__internal::runtime::MessageViewInner::view_of_owned(&self.inner).into()
  }

  pub fn as_mut(&mut self) -> NoKeyTargetMut<'_> {
    ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner).into()
  }

  // label: optional string
  pub fn label(&self) -> ::protobuf::View<'_, ::protobuf::ProtoString> {
    let str_view = unsafe {
      self.inner.ptr().get_string_at_index(
        0, (b"").into()
      )
    };
    // SAFETY: The runtime doesn't require ProtoStr to be UTF-8.
    unsafe { ::protobuf::ProtoStr::from_utf8_unchecked(str_view.as_ref()) }
  }
  pub fn set_label(&mut self, val: impl ::protobuf::IntoProxied<::protobuf::ProtoString>) {
    unsafe {
      ::protobuf::__internal::runtime::message_set_string_field(
        ::protobuf::AsMut::as_mut(self).inner,
        0,
        val);
    }
  }

}  // impl NoKeyTarget

impl ::std::ops::Drop for NoKeyTarget {
  #[inline]
  fn drop(&mut self) {
  }
}

impl ::std::clone::Clone for NoKeyTarget {
  fn clone(&self) -> Self {
    self.as_view().to_owned()
  }
}

impl ::protobuf::AsView for NoKeyTarget {
  type Proxied = Self;
  fn as_view(&self) -> NoKeyTargetView<'_> {
    self.as_view()
  }
}

impl ::protobuf::AsMut for NoKeyTarget {
  type MutProxied = Self;
  fn as_mut(&mut self) -> NoKeyTargetMut<'_> {
    self.as_mut()
  }
}

unsafe impl ::protobuf::__internal::runtime::AssociatedMiniTable for NoKeyTarget {
  fn mini_table() -> ::protobuf::__internal::runtime::MiniTablePtr {
    static ONCE_LOCK: ::std::sync::OnceLock<::protobuf::__internal::runtime::MiniTableInitPtr> =
        ::std::sync::OnceLock::new();
    unsafe {
      ONCE_LOCK.get_or_init(|| {
        super::DATA_0MANAGER_0FIXTURE__NoKeyTarget_msg_init.0 =
            ::protobuf::__internal::runtime::build_mini_table("$M1P");
        ::protobuf::__internal::runtime::link_mini_table(
            super::DATA_0MANAGER_0FIXTURE__NoKeyTarget_msg_init.0, &[], &[]);
        ::protobuf::__internal::runtime::MiniTableInitPtr(super::DATA_0MANAGER_0FIXTURE__NoKeyTarget_msg_init.0)
      }).0
    }
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetArena for NoKeyTarget {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for NoKeyTarget {
  type Msg = NoKeyTarget;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<NoKeyTarget> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for NoKeyTarget {
  type Msg = NoKeyTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<NoKeyTarget> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for NoKeyTargetMut<'_> {
  type Msg = NoKeyTarget;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<NoKeyTarget> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for NoKeyTargetMut<'_> {
  type Msg = NoKeyTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<NoKeyTarget> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for NoKeyTargetView<'_> {
  type Msg = NoKeyTarget;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<NoKeyTarget> {
    self.inner.ptr()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetArena for NoKeyTargetMut<'_> {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}



