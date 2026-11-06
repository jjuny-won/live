package com.jjuny.live.member;

import com.jjuny.live.auth.AuthMember;
import com.jjuny.live.common.BusinessException;
import com.jjuny.live.common.ErrorCode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "회원")
@RestController
@RequestMapping("/api/members")
public class MemberController {

    private final MemberRepository memberRepository;

    public MemberController(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

    @Operation(summary = "내 정보")
    @GetMapping("/me")
    @Transactional(readOnly = true)
    public MemberResponse me(@AuthenticationPrincipal AuthMember authMember) {
        return memberRepository.findById(authMember.id())
                .map(MemberResponse::from)
                .orElseThrow(() -> new BusinessException(ErrorCode.MEMBER_NOT_FOUND));
    }
}
