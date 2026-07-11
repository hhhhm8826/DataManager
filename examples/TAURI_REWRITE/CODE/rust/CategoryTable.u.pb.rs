const _: () = ::protobuf::__internal::assert_compatible_gencode_version("4.34.1-release");
// This variable must not be referenced except by protobuf generated
// code.
pub(crate) static mut d1000__Category_msg_init: ::protobuf::__internal::runtime::MiniTableInitPtr =
    ::protobuf::__internal::runtime::MiniTableInitPtr(::protobuf::__internal::runtime::MiniTablePtr::dangling());
#[allow(non_camel_case_types)]
pub struct Category {
  inner: ::protobuf::__internal::runtime::OwnedMessageInner<Category>
}

impl ::protobuf::Message for Category {}

impl ::std::default::Default for Category {
  fn default() -> Self {
    Self::new()
  }
}

impl ::std::fmt::Debug for Category {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

// SAFETY:
// - `Category` is `Sync` because it does not implement interior mutability.
//    Neither does `CategoryMut`.
unsafe impl Sync for Category {}

// SAFETY:
// - `Category` is `Send` because it uniquely owns its arena and does
//   not use thread-local data.
unsafe impl Send for Category {}

impl ::protobuf::Proxied for Category {
  type View<'msg> = CategoryView<'msg>;
}

impl ::protobuf::__internal::SealedInternal for Category {}

impl ::protobuf::MutProxied for Category {
  type Mut<'msg> = CategoryMut<'msg>;
}

#[derive(Copy, Clone)]
#[allow(dead_code)]
pub struct CategoryView<'msg> {
  inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, Category>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for CategoryView<'msg> {}

impl<'msg> ::protobuf::MessageView<'msg> for CategoryView<'msg> {
  type Message = Category;
}

impl ::std::fmt::Debug for CategoryView<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl ::std::default::Default for CategoryView<'_> {
  fn default() -> CategoryView<'static> {
    ::protobuf::__internal::runtime::MessageViewInner::default().into()
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageViewInner<'msg, Category>> for CategoryView<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageViewInner<'msg, Category>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> CategoryView<'msg> {

  pub fn to_owned(&self) -> Category {
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

  // parent: optional message d1000.Category
  pub fn has_parent(self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(1)
    }
  }
  pub fn parent_opt(self) -> ::protobuf::Optional<super::CategoryView<'msg>> {
        ::protobuf::Optional::new(self.parent(), self.has_parent())
  }
  pub fn parent(self) -> super::CategoryView<'msg> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(1)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::CategoryView::default())
  }

  // children: repeated message d1000.Category
  pub fn children(self) -> ::protobuf::RepeatedView<'msg, super::Category> {
    unsafe {
      self.inner.ptr().get_array_at_index(
        2
      )
    }.map_or_else(
        ::protobuf::__internal::runtime::empty_array::<super::Category>,
        |raw| unsafe {
          ::protobuf::RepeatedView::from_raw(::protobuf::__internal::Private, raw)
        }
      )
  }

}

// SAFETY:
// - `CategoryView` is `Sync` because it does not support mutation.
unsafe impl Sync for CategoryView<'_> {}

// SAFETY:
// - `CategoryView` is `Send` because while its alive a `CategoryMut` cannot.
// - `CategoryView` does not use thread-local data.
unsafe impl Send for CategoryView<'_> {}

impl<'msg> ::protobuf::AsView for CategoryView<'msg> {
  type Proxied = Category;
  fn as_view(&self) -> ::protobuf::View<'msg, Category> {
    *self
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for CategoryView<'msg> {
  fn into_view<'shorter>(self) -> CategoryView<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

impl<'msg> ::protobuf::IntoProxied<Category> for CategoryView<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> Category {
    let mut dst = Category::new();
    assert!(unsafe {
      dst.inner.ptr_mut().deep_copy(self.inner.ptr(), dst.inner.arena())
    });
    dst
  }
}

impl<'msg> ::protobuf::IntoProxied<Category> for CategoryMut<'msg> {
  fn into_proxied(self, _private: ::protobuf::__internal::Private) -> Category {
    ::protobuf::IntoProxied::into_proxied(::protobuf::IntoView::into_view(self), _private)
  }
}

impl ::protobuf::__internal::runtime::EntityType for Category {
    type Tag = ::protobuf::__internal::runtime::MessageTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for CategoryView<'msg> {
    type Tag = ::protobuf::__internal::runtime::ViewProxyTag;
}

impl<'msg> ::protobuf::__internal::runtime::EntityType for CategoryMut<'msg> {
    type Tag = ::protobuf::__internal::runtime::MutProxyTag;
}

#[allow(dead_code)]
#[allow(non_camel_case_types)]
pub struct CategoryMut<'msg> {
  inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, Category>,
}

impl<'msg> ::protobuf::__internal::SealedInternal for CategoryMut<'msg> {}

impl<'msg> ::protobuf::MessageMut<'msg> for CategoryMut<'msg> {
  type Message = Category;
}

impl ::std::fmt::Debug for CategoryMut<'_> {
  fn fmt(&self, f: &mut ::std::fmt::Formatter<'_>) -> ::std::fmt::Result {
    write!(f, "{}", ::protobuf::__internal::runtime::debug_string(self))
  }
}

impl<'msg> From<::protobuf::__internal::runtime::MessageMutInner<'msg, Category>> for CategoryMut<'msg> {
  fn from(inner: ::protobuf::__internal::runtime::MessageMutInner<'msg, Category>) -> Self {
    Self { inner }
  }
}

#[allow(dead_code)]
impl<'msg> CategoryMut<'msg> {

  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private)
    -> ::protobuf::__internal::runtime::MessageMutInner<'msg, Category> {
    self.inner
  }

  pub fn to_owned(&self) -> Category {
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

  // parent: optional message d1000.Category
  pub fn has_parent(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(1)
    }
  }
  pub fn clear_parent(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        1
      );
    }
  }
  pub fn parent_opt(&self) -> ::protobuf::Optional<super::CategoryView<'_>> {
        ::protobuf::Optional::new(self.parent(), self.has_parent())
  }
  pub fn parent(&self) -> super::CategoryView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(1)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::CategoryView::default())
  }
  pub fn parent_mut(&mut self) -> super::CategoryMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         1, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_parent(&mut self,
    val: impl ::protobuf::IntoProxied<super::Category>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        1,
        val
      );
    }
  }

  // children: repeated message d1000.Category
  pub fn children(&self) -> ::protobuf::RepeatedView<'_, super::Category> {
    unsafe {
      self.inner.ptr().get_array_at_index(
        2
      )
    }.map_or_else(
        ::protobuf::__internal::runtime::empty_array::<super::Category>,
        |raw| unsafe {
          ::protobuf::RepeatedView::from_raw(::protobuf::__internal::Private, raw)
        }
      )
  }
  pub fn children_mut(&mut self) -> ::protobuf::RepeatedMut<'_, super::Category> {
    unsafe {
      let raw_array = self.inner.ptr_mut().get_or_create_mutable_array_at_index(
        2,
        self.inner.arena()
      ).expect("alloc should not fail");
      ::protobuf::RepeatedMut::from_inner(
        ::protobuf::__internal::Private,
        ::protobuf::__internal::runtime::InnerRepeatedMut::new(
          raw_array, self.inner.arena(),
        ),
      )
    }
  }
  pub fn set_children(&mut self, src: impl ::protobuf::IntoProxied<::protobuf::Repeated<super::Category>>) {
    unsafe {
      ::protobuf::__internal::runtime::message_set_repeated_field(
        ::protobuf::AsMut::as_mut(self).inner,
        2,
        src);
    }
  }

}

// SAFETY:
// - `CategoryMut` does not perform any shared mutation.
unsafe impl Send for CategoryMut<'_> {}

// SAFETY:
// - `CategoryMut` does not perform any shared mutation.
unsafe impl Sync for CategoryMut<'_> {}

impl<'msg> ::protobuf::AsView for CategoryMut<'msg> {
  type Proxied = Category;
  fn as_view(&self) -> ::protobuf::View<'_, Category> {
    CategoryView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::IntoView<'msg> for CategoryMut<'msg> {
  fn into_view<'shorter>(self) -> ::protobuf::View<'shorter, Category>
  where
      'msg: 'shorter {
    CategoryView {
      inner: ::protobuf::__internal::runtime::MessageViewInner::view_of_mut(self.inner)
    }
  }
}

impl<'msg> ::protobuf::AsMut for CategoryMut<'msg> {
  type MutProxied = Category;
  fn as_mut(&mut self) -> CategoryMut<'msg> {
    CategoryMut { inner: self.inner }
  }
}

impl<'msg> ::protobuf::IntoMut<'msg> for CategoryMut<'msg> {
  fn into_mut<'shorter>(self) -> CategoryMut<'shorter>
  where
      'msg: 'shorter {
    self
  }
}

#[allow(dead_code)]
impl Category {
  pub fn new() -> Self {
    Self { inner: ::protobuf::__internal::runtime::OwnedMessageInner::<Self>::new() }
  }


  #[doc(hidden)]
  pub fn as_message_mut_inner(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessageMutInner<'_, Category> {
    ::protobuf::__internal::runtime::MessageMutInner::mut_of_owned(&mut self.inner)
  }

  pub fn as_view(&self) -> CategoryView<'_> {
    ::protobuf::__internal::runtime::MessageViewInner::view_of_owned(&self.inner).into()
  }

  pub fn as_mut(&mut self) -> CategoryMut<'_> {
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

  // parent: optional message d1000.Category
  pub fn has_parent(&self) -> bool {
    unsafe {
      self.inner.ptr().has_field_at_index(1)
    }
  }
  pub fn clear_parent(&mut self) {
    unsafe {
      self.inner.ptr().clear_field_at_index(
        1
      );
    }
  }
  pub fn parent_opt(&self) -> ::protobuf::Optional<super::CategoryView<'_>> {
        ::protobuf::Optional::new(self.parent(), self.has_parent())
  }
  pub fn parent(&self) -> super::CategoryView<'_> {
    let submsg = unsafe {
      self.inner.ptr().get_message_at_index(1)
    };
    submsg
        .map(|ptr| unsafe { ::protobuf::__internal::runtime::MessageViewInner::wrap(ptr).into() })
       .unwrap_or(super::CategoryView::default())
  }
  pub fn parent_mut(&mut self) -> super::CategoryMut<'_> {
     let ptr = unsafe {
       self.inner.ptr_mut().get_or_create_mutable_message_at_index(
         1, self.inner.arena()
       ).unwrap()
     };
     ::protobuf::__internal::runtime::MessageMutInner::from_parent(
         self.as_message_mut_inner(::protobuf::__internal::Private),
         ptr
     ).into()
  }
  pub fn set_parent(&mut self,
    val: impl ::protobuf::IntoProxied<super::Category>) {

    unsafe {
      ::protobuf::__internal::runtime::message_set_sub_message(
        ::protobuf::AsMut::as_mut(self).inner,
        1,
        val
      );
    }
  }

  // children: repeated message d1000.Category
  pub fn children(&self) -> ::protobuf::RepeatedView<'_, super::Category> {
    unsafe {
      self.inner.ptr().get_array_at_index(
        2
      )
    }.map_or_else(
        ::protobuf::__internal::runtime::empty_array::<super::Category>,
        |raw| unsafe {
          ::protobuf::RepeatedView::from_raw(::protobuf::__internal::Private, raw)
        }
      )
  }
  pub fn children_mut(&mut self) -> ::protobuf::RepeatedMut<'_, super::Category> {
    unsafe {
      let raw_array = self.inner.ptr_mut().get_or_create_mutable_array_at_index(
        2,
        self.inner.arena()
      ).expect("alloc should not fail");
      ::protobuf::RepeatedMut::from_inner(
        ::protobuf::__internal::Private,
        ::protobuf::__internal::runtime::InnerRepeatedMut::new(
          raw_array, self.inner.arena(),
        ),
      )
    }
  }
  pub fn set_children(&mut self, src: impl ::protobuf::IntoProxied<::protobuf::Repeated<super::Category>>) {
    unsafe {
      ::protobuf::__internal::runtime::message_set_repeated_field(
        ::protobuf::AsMut::as_mut(self).inner,
        2,
        src);
    }
  }

}  // impl Category

impl ::std::ops::Drop for Category {
  #[inline]
  fn drop(&mut self) {
  }
}

impl ::std::clone::Clone for Category {
  fn clone(&self) -> Self {
    self.as_view().to_owned()
  }
}

impl ::protobuf::AsView for Category {
  type Proxied = Self;
  fn as_view(&self) -> CategoryView<'_> {
    self.as_view()
  }
}

impl ::protobuf::AsMut for Category {
  type MutProxied = Self;
  fn as_mut(&mut self) -> CategoryMut<'_> {
    self.as_mut()
  }
}

unsafe impl ::protobuf::__internal::runtime::AssociatedMiniTable for Category {
  fn mini_table() -> ::protobuf::__internal::runtime::MiniTablePtr {
    static ONCE_LOCK: ::std::sync::OnceLock<::protobuf::__internal::runtime::MiniTableInitPtr> =
        ::std::sync::OnceLock::new();
    unsafe {
      ONCE_LOCK.get_or_init(|| {
        super::d1000__Category_msg_init.0 =
            ::protobuf::__internal::runtime::build_mini_table("$(P3G");
        ::protobuf::__internal::runtime::link_mini_table(
            super::d1000__Category_msg_init.0, &[super::d1000__Category_msg_init.0,
            super::d1000__Category_msg_init.0,
            ], &[]);
        ::protobuf::__internal::runtime::MiniTableInitPtr(super::d1000__Category_msg_init.0)
      }).0
    }
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetArena for Category {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for Category {
  type Msg = Category;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<Category> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for Category {
  type Msg = Category;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<Category> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtrMut for CategoryMut<'_> {
  type Msg = Category;
  fn get_ptr_mut(&mut self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<Category> {
    self.inner.ptr_mut()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for CategoryMut<'_> {
  type Msg = Category;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<Category> {
    self.inner.ptr()
  }
}
unsafe impl ::protobuf::__internal::runtime::UpbGetMessagePtr for CategoryView<'_> {
  type Msg = Category;
  fn get_ptr(&self, _private: ::protobuf::__internal::Private) -> ::protobuf::__internal::runtime::MessagePtr<Category> {
    self.inner.ptr()
  }
}

unsafe impl ::protobuf::__internal::runtime::UpbGetArena for CategoryMut<'_> {
  fn get_arena(&mut self, _private: ::protobuf::__internal::Private) -> &::protobuf::__internal::runtime::Arena {
    self.inner.arena()
  }
}



